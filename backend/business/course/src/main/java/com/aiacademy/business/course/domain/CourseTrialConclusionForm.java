package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 录入试讲结论的表单（需求 9.7.1 第 7～12 项）。
 *
 * <p><b>两个结论都必填、且互不影响</b>（议题 17）。系统不因为它们不一致就拒绝保存，也不做任何
 * 自动处置——需求 9.7.3：保存成功，界面给一句醒目提示，由线下评审后再由运营维护后续状态。
 *
 * @param acceptanceChecks 验收标准勾选（需求 9.7.2）。<b>仅作记录</b>，不校验「必须全勾才能判合格」
 */
public record CourseTrialConclusionForm(
        List<String> acceptanceChecks,

        @NotBlank(message = "请录入课程试讲结论")
        String courseConclusion,

        @NotBlank(message = "请录入讲师试讲结论")
        String lecturerConclusion,

        @NotBlank(message = "请填写评审专家意见")
        @Size(max = 5000, message = "评审专家意见不超过 5000 字")
        String expertOpinion,

        @Size(max = 5000, message = "问题清单不超过 5000 字")
        String issueList) {
}
