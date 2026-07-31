package com.aiacademy.platform.storage.controller;

import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.platform.storage.domain.Attachment;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import com.aiacademy.platform.storage.domain.AttachmentScene;
import com.aiacademy.platform.storage.domain.FileTypeRules;
import com.aiacademy.platform.storage.domain.UploadTicket;
import com.aiacademy.platform.storage.service.AttachmentService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 附件接口（TD-7，规则 F1～F5、P5）。分片上传三段：申请 → 传片 → 合并。
 *
 * <p><b>下载接口的登录态校验是一期唯一的访问控制点</b>（规则 F3、开发 5.7.3）：
 * 由 {@code SecurityConfig} 统一要求认证，本类不写任何判权（AR-7）。绝不能为了「让前端 img 标签
 * 直接引用」而放开它——那正是 F3 明确禁止的未登录直链访问。
 */
@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    private final AttachmentService attachments;

    public AttachmentController(AttachmentService attachments) {
        this.attachments = attachments;
    }

    /**
     * 申请上传（开发 5.7.2 第 1～3 步）。
     *
     * @param scene 场景码，决定大小上限（规则 F1）。上限按业务位置分，不是全局配置
     */
    @WriteApi
    @PostMapping("/uploads")
    public R<UploadTicket> initUpload(@RequestBody InitUploadRequest body) {
        return R.ok(attachments.initUpload(body.fileName(), body.fileSize(),
                AttachmentScene.of(body.scene()), AttachmentOwnerType.of(body.ownerType())));
    }

    public record InitUploadRequest(String fileName, long fileSize, String scene, String ownerType) {
    }

    /** 查已传分片，供断点续传（规则 P5）。 */
    @GetMapping("/uploads/{uploadId}")
    public R<UploadTicket> uploadStatus(@PathVariable String uploadId) {
        return R.ok(attachments.uploadStatus(uploadId));
    }

    /**
     * 传一个分片。用 PUT 而不是 POST：同一序号重传必须是覆盖，这正是 PUT 的语义，
     * 而断点续传要求边界上的那一片可以重传。
     */
    @WriteApi
    @PutMapping("/uploads/{uploadId}/chunks/{index}")
    public R<Long> uploadChunk(@PathVariable String uploadId,
                               @PathVariable int index,
                               @RequestParam("file") MultipartFile chunk) {
        try {
            return R.ok(attachments.uploadChunk(uploadId, index, chunk.getInputStream()));
        } catch (IOException e) {
            throw new UncheckedIOException("读取分片失败", e);
        }
    }

    /** 通知合并（开发 5.7.2 第 6～9 步），含真实类型校验（规则 F2）。 */
    @WriteApi
    @PostMapping("/uploads/{uploadId}/completion")
    public R<Attachment> complete(@PathVariable String uploadId) {
        return R.ok(attachments.complete(uploadId));
    }

    /** 某对象某字段下的附件列表。 */
    @GetMapping
    public R<List<Attachment>> list(@RequestParam String refType,
                                    @RequestParam long refId,
                                    @RequestParam String refField) {
        return R.ok(attachments.listOf(AttachmentOwnerType.of(refType), refId, refField));
    }

    /** 业务保存时关联附件（开发 5.7.2 第 10 步）。没有这一步，附件 24 小时后会被当孤儿清理。 */
    @WriteApi
    @PostMapping("/{id}/references")
    public R<Void> link(@PathVariable long id, @RequestBody LinkRequest body) {
        attachments.link(id, AttachmentOwnerType.of(body.refType()), body.refId(),
                body.refField(), body.seqNo());
        return R.ok();
    }

    public record LinkRequest(String refType, long refId, String refField, int seqNo) {
    }

    @WriteApi
    @DeleteMapping("/{id}/references")
    public R<Void> unlink(@PathVariable long id, @RequestBody LinkRequest body) {
        attachments.unlink(id, AttachmentOwnerType.of(body.refType()), body.refId(), body.refField());
        return R.ok();
    }

    /**
     * 下载（规则 F3）。流式返回，不把文件读进内存——两三个人同时下 200MB 就能把堆打满
     * （开发 5.7.3）。
     */
    @GetMapping("/{id}/download")
    public ResponseEntity<InputStreamResource> download(@PathVariable long id) {
        AttachmentService.DownloadableAttachment file = attachments.download(id);
        Attachment meta = file.meta();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        meta.contentType() == null
                                ? FileTypeRules.contentTypeOf(meta.fileName())
                                : meta.contentType()))
                .contentLength(meta.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(meta.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(new InputStreamResource(file.content()));
    }

    /** 逻辑删除（规则 F5）。文件不删——历史版本快照可能仍引用同一个文件对象。 */
    @WriteApi
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable long id) {
        attachments.delete(id);
        return R.ok();
    }
}
