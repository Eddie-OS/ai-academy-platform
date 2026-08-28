package com.aiacademy.business.course.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 材料版本快照（需求 9.5，规则 R7）。
 *
 * @param triggerType 快照触发方式：提交评审自动 / 手动创建（需求 9.5.2 第 5 项）
 * @param boundReviewRound 绑定本版本的评审轮次；没有评审绑定时为 null。
 *                         需求 9.5.3 要求版本历史列表展示它——运营据此知道「这个版本被评过没有」
 * @param versionLabel 台账别名，如 V1.0 初稿。官方 {@code versionNo} 仍按 V1／V2 自动递增
 * @param versionStatus 生效版本／历史归档／废弃版本。台账，不是状态机
 */
public record CourseMaterialVersion(
        Long id,
        Long courseId,
        String versionNo,
        String triggerType,
        String remark,
        Integer boundReviewRound,
        String versionLabel,
        String versionStatus,
        String ownerNo,
        LocalDate updatedDate,
        String coursewareUrl,
        String recordingUrl,
        OffsetDateTime createdAt,
        String createdBy) {
}
