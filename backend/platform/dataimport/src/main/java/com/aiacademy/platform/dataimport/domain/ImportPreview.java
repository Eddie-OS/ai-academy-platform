package com.aiacademy.platform.dataimport.domain;

import java.util.List;

/**
 * 上传校验的结果，对应需求 13.8.3 第 3、4 步的界面。
 *
 * <p>错误行表格默认只展示前 100 条，完整清单靠下载（规则 I4、13.8.3 第 3 步），因此这里的
 * {@code errors} 是截断后的；{@code errorCount} 才是总数。
 *
 * @param canConfirm 是否允许确认写入。存在任一错误行即为 false（规则 I3），前端据此禁用确认按钮
 * @param notes 提示语，如反馈导入的「本场次已有 N 条反馈，本次将追加 M 条」（规则 FB5）
 */
public record ImportPreview(
        String batchNo,
        String importType,
        String fileName,
        int totalRows,
        int insertRows,
        int updateRows,
        int skipRows,
        boolean canConfirm,
        int errorCount,
        int warningCount,
        List<RowProblem> errors,
        List<RowProblem> warnings,
        List<String> notes,
        boolean errorReportAvailable) {

    /** 需求 13.8.3：错误行表格默认显示前 100 条，超出提示下载完整报告。 */
    public static final int PROBLEM_PREVIEW_LIMIT = 100;
}
