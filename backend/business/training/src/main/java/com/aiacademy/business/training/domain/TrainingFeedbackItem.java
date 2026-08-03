package com.aiacademy.business.training.domain;

import java.time.OffsetDateTime;

/**
 * 一条学员反馈（需求 11.7.2）。
 *
 * <p><b>{@code submitterNo} 为 null 就是匿名</b>：库里存的就是 NULL，不是「存了但界面不显示」
 * （出口准则 E1-7）。前端遇到 null 显示「匿名」。
 *
 * @param importedAt 导入时间，同时作为「提交时间」展示（需求 11.7.2 第 9 项）
 * @param opsRemark  运营备注，是内部记录。反馈正文 {@code content} 任何账号不可修改（规则 FB1），
 *                   要改的只有这一列
 */
public record TrainingFeedbackItem(
        long id,
        long sessionId,
        String submitterNo,
        String submitterName,
        String submitterDept,
        int score,
        String content,
        String feedbackScene,
        String importBatchNo,
        OffsetDateTime importedAt,
        String opsRemark,
        OffsetDateTime remarkedAt) {

    public boolean anonymous() {
        return submitterNo == null || submitterNo.isBlank();
    }
}
