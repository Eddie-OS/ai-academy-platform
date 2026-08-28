package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 课程详情「评审」页台账：基础信息 + 初步评审 + 上会评审。
 *
 * <p>不改五个状态列，也不写流转日志。官方评审记录仍走录入结论接口。
 *
 * @param version 乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record CourseReviewLedgerForm(
        @Size(max = 50, message = "负责人工号不超过 50 字")
        String ownerNo,
        @Size(max = 64, message = "评审轮数不超过 64 字")
        String reviewRoundLabel,
        LocalDate reviewCompletedDate,
        @Size(max = 64, message = "当前评审阶段不超过 64 字")
        String reviewLedgerPhase,
        @Size(max = 64, message = "评审状态不超过 64 字")
        String reviewLedgerStatus,
        @Size(max = 8, message = "是否进入试讲只能是「是」或「否」")
        String enterTrial,
        @Size(max = 64, message = "初步评审轮数不超过 64 字")
        String prelimRoundLabel,
        @Size(max = 500, message = "初步评审人员不超过 500 字")
        String prelimReviewers,
        LocalDate prelimReviewDate,
        LocalDate prelimCompletedDate,
        @Size(max = 64, message = "初步评审结论不超过 64 字")
        String prelimConclusion,
        String prelimOpinion,
        @Size(max = 8, message = "是否进入上会只能是「是」或「否」")
        String enterMeeting,
        @Size(max = 64, message = "上会评审轮数不超过 64 字")
        String meetingRoundLabel,
        @Size(max = 500, message = "上会评审人员不超过 500 字")
        String meetingReviewers,
        LocalDate meetingActualDate,
        @Size(max = 64, message = "上会最终结论不超过 64 字")
        String meetingConclusion,
        String meetingOpinion,
        Integer version) {
}
