package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 课程详情「试讲」页台账：基础信息 + 排期 + 反馈 + 结论。
 *
 * <p>不改五个状态列，也不写流转日志。官方试讲记录仍走录入结论接口。
 *
 * @param version 乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record CourseTrialLedgerForm(
        @Size(max = 50, message = "负责人工号不超过 50 字")
        String ownerNo,
        @Size(max = 32, message = "授课讲师工号不超过 32 字")
        String trialLecturerNo,
        @Size(max = 64, message = "试讲当前阶段不超过 64 字")
        String trialCurrentPhase,
        @Size(max = 64, message = "试讲状态不超过 64 字")
        String trialLedgerStatus,
        @Size(max = 64, message = "试讲轮数不超过 64 字")
        String trialRoundLabel,
        LocalDate trialScheduledDate,
        @Size(max = 200, message = "学员群体不超过 200 字")
        String trialAudienceGroup,
        @Size(max = 32, message = "学员人数不超过 32 字")
        String trialAudienceCount,
        BigDecimal trialHours,
        @Size(max = 64, message = "试讲形式不超过 64 字")
        String trialFormat,
        String trialSatisfaction,
        String trialOptimizeAdvice,
        @Size(max = 64, message = "试讲验收结果不超过 64 字")
        String trialAcceptanceResult,
        @Size(max = 8, message = "是否满足发布要求只能是「是」或「否」")
        String trialReadyToPublish,
        @Size(max = 8, message = "讲师试讲是否合格只能是「是」或「否」")
        String trialLecturerQualified,
        LocalDate trialConclusionDate,
        String trialRemark,
        Integer version) {
}
