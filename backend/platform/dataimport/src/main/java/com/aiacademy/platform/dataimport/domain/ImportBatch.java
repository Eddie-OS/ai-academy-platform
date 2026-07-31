package com.aiacademy.platform.dataimport.domain;

import java.time.OffsetDateTime;

/**
 * 导入批次一行（需求 13.8.4 的十个字段）。
 *
 * @param batchState 幂等状态机：待确认 → 已写入（开发 5.6.3 细节五）
 * @param importResult 成功 / 校验失败 / 已撤销。上传后尚未确认时为 null，批次列表不展示这类行
 * @param importedAt <b>写入时间</b>，确认写入时置。撤销时判断「这一行有没有被后续修改过」
 *                   （规则 RB3）就是拿它与目标行的 {@code updated_at} 比，因此它必须是写入那一刻的
 *                   时间戳，不能提前到上传时
 */
public record ImportBatch(
        Long id,
        String batchNo,
        String importType,
        String fileName,
        String sourcePath,
        Integer totalRows,
        Integer insertRows,
        Integer updateRows,
        String batchState,
        String importResult,
        String errorReportPath,
        OffsetDateTime importedAt,
        OffsetDateTime createdAt,
        String createdBy) {

    public static final String STATE_PENDING = "待确认";
    public static final String STATE_WRITTEN = "已写入";

    public static final String RESULT_SUCCESS = "成功";
    public static final String RESULT_VALIDATION_FAILED = "校验失败";
    public static final String RESULT_REVOKED = "已撤销";

    public ImportType type() {
        return ImportType.ofLabel(importType);
    }
}
