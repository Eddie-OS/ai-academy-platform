package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * 新建一轮试讲的表单（需求 9.7.1 第 4～6 项）。
 *
 * <p>轮次不在这里：它是「已有记录数 + 1」，由系统算。
 *
 * @param attachmentIds 试讲录像、评分表等（需求 9.7.1 第 13 项）。附件先上传拿到 ID，这里只做关联
 */
public record CourseTrialForm(
        @NotNull(message = "请填写试讲日期")
        LocalDate trialDate,

        @NotNull(message = "请选择试讲讲师")
        Long lecturerId,

        @Size(max = 500, message = "参与验收人员不超过 500 字")
        String participants,

        List<Long> attachmentIds) {
}
