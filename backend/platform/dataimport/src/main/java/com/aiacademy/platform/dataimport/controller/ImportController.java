package com.aiacademy.platform.dataimport.controller;

import com.aiacademy.common.api.PageQuery;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.platform.dataimport.domain.ImportBatch;
import com.aiacademy.platform.dataimport.domain.ImportPreview;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.domain.RevokeResult;
import com.aiacademy.platform.dataimport.service.ImportBatchQuery;
import com.aiacademy.platform.dataimport.service.ImportService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 导入中心（需求 13.8.2 的三个区域、13.8.3 的三步向导、13.8.5 的撤销）。
 *
 * <p>上传与确认是<b>两个接口</b>，这是需求 13.8.3 的向导语义：运营先看预览与错误报告，再决定写不写。
 * 合成一个接口就没有「先校验后写入」（规则 I3）可言了。
 *
 * <p><b>写接口的运营账号限制由 {@code PermissionInterceptor} 统一完成</b>（规则 AR-7）：
 * 本类只用 {@link WriteApi} 声明开放范围，不做任何账号类型判断。
 *
 * <p>规则 I7「导入仅运营账号可用」只约束写侧。读接口（批次列表、原文件与错误报告下载）
 * 按纪律 PMI-2 对两个账号无差别开放：一期读权限完全无差异，给读接口单独加限制既无依据，
 * 也会让「无权限」状态页出现在一个本该人人可看的页面上。
 */
@RestController
@RequestMapping("/api/imports")
public class ImportController {

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ImportService imports;
    private final ImportBatchQuery batches;

    public ImportController(ImportService imports, ImportBatchQuery batches) {
        this.imports = imports;
        this.batches = batches;
    }

    /**
     * 6 类导入的清单（需求 13.8.2 区域 A）。
     *
     * <p>存在这个接口只有一个理由：<b>不让前端手写这 6 个中文名</b>（纪律 STK-1）。
     * 前端的导入类型下拉、模板下载按钮、批次列表筛选项都取自这里，枚举增删时不会漏改某一处。
     *
     * @param code 路径用的小写连字符名（规则 API-1），如 {@code training-feedback}
     */
    public record ImportTypeOption(String code, String label, String templateFileName, boolean appendOnly) {

        static ImportTypeOption of(ImportType type) {
            return new ImportTypeOption(type.name().toLowerCase().replace('_', '-'), type.label(),
                    type.templateFileName(), type.appendOnly());
        }
    }

    @GetMapping("/types")
    public R<List<ImportTypeOption>> types() {
        return R.ok(java.util.Arrays.stream(ImportType.values()).map(ImportTypeOption::of).toList());
    }

    /**
     * 下载导入模板（需求 13.8.2 区域 A）。
     *
     * <p>模板现场由列声明生成而不是放一个静态文件：静态文件与解析器会各自演化，
     * 而运营手里的模板对不上时报出来的错是「表头不一致」，看起来像是运营填错了。
     */
    @GetMapping("/templates/{type}")
    public ResponseEntity<byte[]> template(@PathVariable String type) {
        ImportType importType = ImportType.of(type);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        imports.writeTemplate(importType, out);
        return ResponseEntity.ok()
                .contentType(XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION, attachmentHeader(importType.templateFileName()))
                .body(out.toByteArray());
    }

    /** 第一步：上传并校验，不写业务数据（规则 I3）。 */
    @WriteApi
    @PostMapping("/{type}/uploads")
    public R<ImportPreview> upload(@PathVariable String type, @RequestParam("file") MultipartFile file) {
        try {
            return R.ok(imports.upload(ImportType.of(type), file.getOriginalFilename(), file.getInputStream()));
        } catch (IOException e) {
            throw new UncheckedIOException("读取上传文件失败", e);
        }
    }

    /** 第二步：确认写入。重复提交返回 DUPLICATE_SUBMIT（规则 I8）。 */
    @WriteApi
    @PostMapping("/{batchNo}/confirmation")
    public R<ImportBatch> confirm(@PathVariable String batchNo) {
        return R.ok(imports.confirm(batchNo));
    }

    /** 撤销整批（需求 13.8.5，规则 RB1～RB9）。 */
    @WriteApi
    @PostMapping("/{batchNo}/revocation")
    public R<RevokeResult> revoke(@PathVariable String batchNo) {
        return R.ok(imports.revoke(batchNo));
    }

    /** 批次列表（需求 13.8.4）：按导入类型、导入结果、导入时间区间筛选，默认导入时间倒序。 */
    @GetMapping
    public R<PageResult<ImportBatch>> page(@RequestParam(required = false) String type,
                                           @RequestParam(required = false) String result,
                                           @RequestParam(required = false)
                                           @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
                                           @RequestParam(required = false)
                                           @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
                                           PageQuery query) {
        // 类型入参允许是枚举名，但库里存的是中文名（import_batch.import_type 的 CHECK 约束）
        String typeLabel = type == null || type.isBlank() ? null : ImportType.of(type).label();
        return R.ok(batches.list(typeLabel, blankToNull(result), from, to, query));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    @GetMapping("/{batchNo}")
    public R<ImportBatch> detail(@PathVariable String batchNo) {
        return R.ok(batches.require(batchNo));
    }

    /** 下载原文件（需求 13.8.4）。撤销后仍可下载——运营撤销往往是为了改完重导。 */
    @GetMapping("/{batchNo}/source-file")
    public ResponseEntity<InputStreamResource> sourceFile(@PathVariable String batchNo) {
        return streamOf(imports.sourceFile(batchNo));
    }

    /** 下载错误报告（规则 I4）。 */
    @GetMapping("/{batchNo}/error-report")
    public ResponseEntity<InputStreamResource> errorReport(@PathVariable String batchNo) {
        return streamOf(imports.errorReport(batchNo));
    }

    /**
     * 流式返回，不把文件读进内存。
     *
     * <p>{@code contentLength} 必须给：没有它响应会走 chunked 编码，浏览器的下载进度条不显示总量，
     * 而运营下载 5000 行导入的原文件时看不到进度会以为卡住了。
     */
    private ResponseEntity<InputStreamResource> streamOf(ImportService.DownloadableFile file) {
        return ResponseEntity.ok()
                .contentType(XLSX)
                .contentLength(file.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, attachmentHeader(file.fileName()))
                .body(new InputStreamResource(file.content()));
    }

    /** 文件名含中文，必须按 RFC 5987 编码，否则在部分浏览器上会变成乱码或空文件名。 */
    private static String attachmentHeader(String fileName) {
        return ContentDisposition.attachment()
                .filename(fileName, StandardCharsets.UTF_8)
                .build()
                .toString();
    }
}
