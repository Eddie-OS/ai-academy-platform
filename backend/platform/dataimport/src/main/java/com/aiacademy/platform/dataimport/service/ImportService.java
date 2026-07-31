package com.aiacademy.platform.dataimport.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.audit.service.OpLogWriter;
import com.aiacademy.platform.dataimport.ImportHandler;
import com.aiacademy.platform.dataimport.domain.ImportBatch;
import com.aiacademy.platform.dataimport.domain.ImportPlan;
import com.aiacademy.platform.dataimport.domain.ImportPreview;
import com.aiacademy.platform.dataimport.domain.ImportProblems;
import com.aiacademy.platform.dataimport.domain.ImportRow;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.domain.RevokeResult;
import com.aiacademy.platform.dataimport.domain.RowProblem;
import com.aiacademy.platform.dataimport.domain.SnapshotRow;
import com.aiacademy.platform.dataimport.repository.ImportBatchMapper;
import com.aiacademy.platform.dataimport.repository.RowSnapshotRepository;
import com.aiacademy.platform.storage.service.LocalFileStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 导入的通用流程（TD-6）：上传校验 → 确认写入 → 批次撤销。
 *
 * <p>三段分别对应需求 13.8.3 的向导与 13.8.5 的撤销。<b>业务无关的规则全部在这里，一处实现</b>：
 * I1 行数上限、I2 示例行、I3 先校验后写入、I4 错误报告、I5 批次号、I6 审计日志、I8 幂等、
 * RB1～RB9 撤销。各 {@link ImportHandler} 只写业务校验与逐行写入。
 */
@Service
public class ImportService {

    private static final Logger log = LoggerFactory.getLogger(ImportService.class);

    /** 规则 I5：对象类型缩写 + 年月日时分秒。 */
    private static final DateTimeFormatter BATCH_NO_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private static final String ERROR_REPORT_NAME = "错误报告.xlsx";
    private static final String OBJECT_TYPE = "IMPORT_BATCH";

    private final Map<ImportType, ImportHandler> handlers = new EnumMap<>(ImportType.class);
    private final ExcelSheetReader reader;
    private final ImportTemplateWriter templateWriter;
    private final ErrorReportWriter errorReportWriter;
    private final ImportBatchMapper batches;
    private final RowSnapshotRepository snapshots;
    private final LocalFileStore files;
    private final OpLogWriter opLog;
    private final ImportFailureRecorder failureRecorder;

    /**
     * <b>启动期就要求 6 类导入的 Handler 齐全</b>（需求 13.8.2、开发 8.5 交付项）。
     *
     * <p>缺一个的表现本来会是「运营点了某类导入，接口返回 400 未知类型」——那要等到有人真去点。
     * 放在构造器里，缺失就起不来，代价是启动失败，收益是不可能漏交付一类导入。
     */
    public ImportService(List<ImportHandler> handlerBeans,
                         ExcelSheetReader reader,
                         ImportTemplateWriter templateWriter,
                         ErrorReportWriter errorReportWriter,
                         ImportBatchMapper batches,
                         RowSnapshotRepository snapshots,
                         LocalFileStore files,
                         OpLogWriter opLog,
                         ImportFailureRecorder failureRecorder) {
        for (ImportHandler handler : handlerBeans) {
            ImportHandler existing = handlers.put(handler.type(), handler);
            if (existing != null) {
                throw new IllegalStateException("导入类型 %s 有两个 Handler：%s 与 %s"
                        .formatted(handler.type(), existing.getClass(), handler.getClass()));
            }
        }
        List<ImportType> missing = java.util.Arrays.stream(ImportType.values())
                .filter(type -> !handlers.containsKey(type))
                .toList();
        if (!missing.isEmpty()) {
            throw new IllegalStateException("缺少导入 Handler：" + missing);
        }
        this.reader = reader;
        this.templateWriter = templateWriter;
        this.errorReportWriter = errorReportWriter;
        this.batches = batches;
        this.snapshots = snapshots;
        this.files = files;
        this.opLog = opLog;
        this.failureRecorder = failureRecorder;
    }

    // -------------------------------------------------------------------------
    // 第一步：上传并校验
    // -------------------------------------------------------------------------

    /**
     * 上传原文件、全量校验、建批次（规则 I3、I4、I5）。<b>不写任何业务数据。</b>
     *
     * <p>原文件必须落盘：确认写入是另一次 HTTP 请求，那时要重新解析同一份文件
     * （开发 5.6.3 细节一要求写入前重新校验）；批次列表的「下载原文件」也用它。
     */
    @Transactional
    public ImportPreview upload(ImportType type, String fileName, InputStream content) {
        ImportHandler handler = handlerOf(type);
        String batchNo = nextBatchNo(type);
        String safeName = LocalFileStore.sanitizeFileName(fileName);
        Path sourcePath = sourcePathOf(batchNo, safeName);
        files.write(sourcePath, content);

        ImportProblems problems = new ImportProblems();
        List<ImportRow> rows = readRows(handler, sourcePath, problems);
        ImportPlan plan = problems.hasErrors() && rows.isEmpty()
                ? new ImportPlan()
                : handler.plan(rows, problems);

        String errorReportPath = null;
        if (!problems.all().isEmpty()) {
            errorReportPath = writeErrorReport(batchNo, problems.all());
        }

        boolean canConfirm = !problems.hasErrors();
        batches.insertBatch(batchNo, type.label(), safeName, sourcePath.toString().replace('\\', '/'),
                rows.size(), plan.insertRows(), plan.updateRows(),
                ImportBatch.STATE_PENDING,
                canConfirm ? null : ImportBatch.RESULT_VALIDATION_FAILED,
                errorReportPath,
                operator());

        return new ImportPreview(batchNo, type.label(), safeName,
                rows.size(), plan.insertRows(), plan.updateRows(), plan.skipRows(),
                canConfirm,
                problems.errors().size(), problems.warnings().size(),
                limited(problems.errors()), limited(problems.warnings()),
                plan.notes(), errorReportPath != null);
    }

    // -------------------------------------------------------------------------
    // 第二步：确认写入
    // -------------------------------------------------------------------------

    /**
     * 确认写入（规则 I8 幂等、K3）。
     *
     * <p>三件事必须在同一个事务里：批次状态置「已写入」、业务数据写入、行快照写入。
     * 任一步失败全部回滚——否则会出现「批次显示成功但数据只写了一半」，而这种状态无法撤销修复
     * （撤销依赖快照，而快照也只写了一半）。
     *
     * @return 写入后的批次
     */
    @Transactional
    public ImportBatch confirm(String batchNo) {
        ImportBatch batch = requireBatch(batchNo);
        if (ImportBatch.RESULT_VALIDATION_FAILED.equals(batch.importResult())) {
            throw new BizException(ErrorCode.IMPORT_VALIDATION_FAILED,
                    "该批次校验未通过，不能写入。请修正文件后重新上传（规则 I3）");
        }
        ImportHandler handler = handlerOf(batch.type());

        // 写入前重新校验（开发 5.6.3 细节一）：上传时那个场次还在，运营点确认之前它可能已经被删了
        ImportProblems problems = new ImportProblems();
        List<ImportRow> rows = readRows(handler, Path.of(batch.sourcePath()), problems);
        ImportPlan plan = handler.plan(rows, problems);
        if (problems.hasErrors()) {
            String errorReportPath = writeErrorReport(batchNo, problems.all());
            // 独立事务：紧接着要抛异常，写在本事务里会被一起回滚，批次将停留在「待确认」而没有任何留痕
            failureRecorder.recordValidationFailure(batchNo, rows.size(), errorReportPath, operator());
            throw new BizException(ErrorCode.IMPORT_VALIDATION_FAILED,
                    "数据在上传后发生了变化，本次导入不再有效，请重新上传（%d 个错误）"
                            .formatted(problems.errors().size()));
        }

        // 幂等：待确认 → 已写入 的 CAS。放在写入之前，重复提交不必先跑一遍 5000 行
        int updated = batches.markWritten(batchNo, rows.size(), plan.insertRows(), plan.updateRows(), operator());
        if (updated == 0) {
            throw new BizException(ErrorCode.DUPLICATE_SUBMIT, "该批次已写入，请勿重复提交（规则 I8）");
        }

        handler.write(plan, new SnapshotRowWriter(snapshots, batchNo, operator()));

        // 规则 I6：一次导入写一条审计日志，记批次号、行数、成功数。
        // 不逐行写——5000 行会往审计表塞 5000 条同质记录，把真正需要追溯的手工修改淹掉；
        // 行级追溯由 import_row_snapshot 承担，它本来就每行一条。
        opLog.record(OBJECT_TYPE, batch.id(), OpType.IMPORT,
                "导入批次 %s（%s）：共 %d 行，新增 %d，更新 %d".formatted(
                        batchNo, batch.importType(), rows.size(), plan.insertRows(), plan.updateRows()));

        log.info("导入批次 {} 写入完成：共 {} 行，新增 {}，更新 {}，忽略 {}",
                batchNo, rows.size(), plan.insertRows(), plan.updateRows(), plan.skipRows());
        return requireBatch(batchNo);
    }

    // -------------------------------------------------------------------------
    // 第三步：撤销
    // -------------------------------------------------------------------------

    /**
     * 按批次撤销（需求 13.8.5，规则 RB2～RB7）。
     *
     * <p><b>通用实现，不按导入类型分支。</b>还原依据是 {@code import_row_snapshot}：
     * INSERT 的行逻辑删除，UPDATE 的行用 JSONB 前值整行写回。因此新增一类导入不需要动撤销逻辑，
     * 只要它的写入走了 {@link com.aiacademy.platform.dataimport.ImportRowWriter}。
     *
     * <p>两类反馈导入的撤销（规则 RB7「整批逻辑删除」）也落在这套逻辑里：它们只有 INSERT 行，
     * 通用逻辑对 INSERT 行做的正是逻辑删除，因此不需要特例。
     */
    @Transactional
    public RevokeResult revoke(String batchNo) {
        ImportBatch batch = requireBatch(batchNo);
        if (ImportBatch.RESULT_REVOKED.equals(batch.importResult())) {
            throw new BizException(ErrorCode.DUPLICATE_SUBMIT, "该批次已撤销，不可重复撤销（规则 RB4）");
        }
        if (!ImportBatch.RESULT_SUCCESS.equals(batch.importResult())) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "只有导入成功的批次可以撤销。校验失败的批次未写入任何数据，无需撤销（规则 RB6）");
        }
        if (batches.markRevoked(batchNo, operator()) == 0) {
            // CAS 失败说明并发撤销已被别人抢先
            throw new BizException(ErrorCode.DUPLICATE_SUBMIT, "该批次已撤销，不可重复撤销（规则 RB4）");
        }

        int revoked = 0;
        List<Integer> skipped = new ArrayList<>();
        for (SnapshotRow snapshot : snapshots.findByBatchDesc(batchNo)) {
            boolean done = snapshot.isInsert()
                    ? snapshots.logicalDelete(snapshot.targetTable(), snapshot.targetId(),
                            batch.importedAt(), operator())
                    : snapshots.restore(snapshot.targetTable(), snapshot.targetId(),
                            snapshot.beforeJson(), batch.importedAt());
            if (done) {
                revoked++;
            } else {
                // 规则 RB3：这一行在本批次之后又被改过，不还原，列进跳过清单
                skipped.add(snapshot.rowNo());
            }
        }

        // 规则 RB5：撤销本身写审计日志，记回滚条数与跳过条数
        opLog.record(OBJECT_TYPE, batch.id(), OpType.REVOKE_IMPORT,
                "撤销导入批次 %s（%s）：回滚 %d 行，跳过 %d 行".formatted(
                        batchNo, batch.importType(), revoked, skipped.size()));

        log.info("导入批次 {} 已撤销：回滚 {} 行，跳过 {} 行", batchNo, revoked, skipped.size());
        return new RevokeResult(batchNo, revoked, skipped.size(), skipped);
    }

    // -------------------------------------------------------------------------
    // 模板与文件下载
    // -------------------------------------------------------------------------

    /** 模板下载（需求 13.8.2 区域 A）。文件由列声明现场生成，见 {@link ImportTemplateWriter}。 */
    public void writeTemplate(ImportType type, java.io.OutputStream out) {
        templateWriter.write(handlerOf(type).template(), out);
    }

    public DownloadableFile sourceFile(String batchNo) {
        ImportBatch batch = requireBatch(batchNo);
        Path path = Path.of(batch.sourcePath());
        if (!files.exists(path)) {
            throw new NotFoundException("原文件已不存在：" + batchNo);
        }
        return new DownloadableFile(batch.fileName(), files.open(path), files.size(path));
    }

    public DownloadableFile errorReport(String batchNo) {
        ImportBatch batch = requireBatch(batchNo);
        if (batch.errorReportPath() == null) {
            throw new NotFoundException("该批次没有错误报告：" + batchNo);
        }
        Path path = Path.of(batch.errorReportPath());
        return new DownloadableFile(batchNo + "-" + ERROR_REPORT_NAME, files.open(path), files.size(path));
    }

    /** @param content 调用方负责关闭 */
    public record DownloadableFile(String fileName, InputStream content, long size) {
    }

    // -------------------------------------------------------------------------
    // 内部
    // -------------------------------------------------------------------------

    private List<ImportRow> readRows(ImportHandler handler, Path sourcePath, ImportProblems problems) {
        try (InputStream in = files.open(sourcePath)) {
            return reader.read(in, handler.template(), problems);
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    private String writeErrorReport(String batchNo, List<RowProblem> problems) {
        Path path = importDirOf(batchNo).resolve(ERROR_REPORT_NAME);
        files.write(path, new ByteArrayInputStream(errorReportWriter.write(problems)));
        return path.toString().replace('\\', '/');
    }

    private ImportHandler handlerOf(ImportType type) {
        ImportHandler handler = handlers.get(type);
        if (handler == null) {
            throw new BizException(ErrorCode.PARAM_INVALID, "未知的导入类型：" + type);
        }
        return handler;
    }

    private ImportBatch requireBatch(String batchNo) {
        ImportBatch batch = batches.findByNo(batchNo);
        if (batch == null) {
            throw new NotFoundException("导入批次不存在：" + batchNo);
        }
        return batch;
    }

    /**
     * 批次号（规则 I5）。
     *
     * <p>同类型同一秒内发起第二次导入会撞号——一个人手工上传文件时不可能，自动化测试里会。
     * 撞号时往后挪一秒重试，而不是加随机后缀：格式是需求规定的「缩写 + 年月日时分秒」，
     * 批次号会出现在运营的对账表里，保持可预期比避免一次重试更重要。
     */
    private String nextBatchNo(ImportType type) {
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < 60; i++) {
            String candidate = type.abbr() + now.plusSeconds(i).format(BATCH_NO_TIME);
            if (batches.findByNo(candidate) == null) {
                return candidate;
            }
        }
        throw new BizException(ErrorCode.INTERNAL_ERROR, "批次号生成失败，请稍后重试");
    }

    private Path importDirOf(String batchNo) {
        return Path.of("import", batchNo);
    }

    private Path sourcePathOf(String batchNo, String fileName) {
        return importDirOf(batchNo).resolve(fileName);
    }

    private static List<RowProblem> limited(List<RowProblem> problems) {
        return problems.size() <= ImportPreview.PROBLEM_PREVIEW_LIMIT
                ? problems
                : problems.subList(0, ImportPreview.PROBLEM_PREVIEW_LIMIT);
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
