package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 课程详情「立项」页整页保存。
 *
 * <p>不改五个状态列，也不写流转日志。立项状态与评审结论是字典项，由运营手选。
 *
 * @param version 乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record CourseInitiationForm(
        String businessPain,
        String courseGoal,
        String courseValue,
        @Size(max = 500, message = "目标受众不超过 500 字")
        String targetAudience,
        String outlineSummary,
        BigDecimal estimateDevDays,
        String reviewJudges,
        LocalDate initiationReviewDate,
        String initiationReviewConclusion,
        String initiationReviewOpinion,
        String initiationStatus,
        Integer version) {
}
