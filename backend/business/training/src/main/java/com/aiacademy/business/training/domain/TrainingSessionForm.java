package com.aiacademy.business.training.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * 培训场次的新建与编辑表单（需求 11.4 的可编辑字段）。
 *
 * <p><b>不含所属计划。</b>它由路径参数带入，且建好之后不允许改挂到别的计划下——场次号是
 * 「计划号-序号」，换计划就得换号，而场次号是三类导入模板的关联键（需求 14.4／14.6／14.8），
 * 换号会让运营手上已经填好的表格全部对不上。
 *
 * <p><b>不含场次状态与实际签到人数。</b>前者只能由状态机引擎写，后者是签到记录的实时 COUNT。
 *
 * @param durationHours 留空时由起止时间算出（需求 11.4 第 8 项）；填了就以填的为准——
 *                      中间休息一小时这类情况只能手工覆盖
 */
public record TrainingSessionForm(
        @Size(max = 100, message = "场次名称不超过 100 字")
        String sessionName,

        @NotNull(message = "请选择关联课程")
        Long courseId,

        @NotNull(message = "请选择授课讲师")
        Long lecturerId,

        @NotNull(message = "请填写培训日期")
        LocalDate trainingDate,

        @NotNull(message = "请填写开始时间")
        LocalTime startTime,

        @NotNull(message = "请填写结束时间")
        LocalTime endTime,

        BigDecimal durationHours,

        @NotBlank(message = "请选择培训形式")
        String trainingForm,

        @Size(max = 200, message = "培训地点不超过 200 字")
        String venue,

        @Size(max = 500, message = "线上链接不超过 500 字")
        String onlineLink,

        @NotBlank(message = "请填写学员范围")
        @Size(max = 500, message = "学员范围不超过 500 字")
        String studentScope,

        @Positive(message = "计划人数必须大于 0")
        Integer planAttendeeCount,

        @Size(max = 1000, message = "备注不超过 1000 字")
        String remark) {
}
