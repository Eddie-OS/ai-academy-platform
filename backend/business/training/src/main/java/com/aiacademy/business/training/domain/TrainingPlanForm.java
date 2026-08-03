package com.aiacademy.business.training.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 培训计划的新建与编辑表单（需求 11.3 的可编辑字段）。
 *
 * <p><b>不含计划状态与实际完成时间。</b>前者只能由状态机引擎写，后者是状态首次进入「已完成」时
 * 自动写下的（需求 11.3 第 12 项）。放进表单就等于允许运营手填一个与流转日志对不上的完成时间，
 * 而 15.2.1 第 9 项的按时完成率正是拿它算的。
 *
 * <p><b>不含实际场次数。</b>它是下属场次的记录数，COUNT 出来而不是填进来。
 *
 * <p><b>不含代理人。</b>V1.2 已删除代理机制（N19）。
 */
public record TrainingPlanForm(
        @NotBlank(message = "请填写计划名称")
        @Size(max = 100, message = "计划名称不超过 100 字")
        String planName,

        @NotNull(message = "请选择关联课程")
        Long courseId,

        @NotBlank(message = "请选择培训负责人")
        String ownerNo,

        @NotBlank(message = "请填写面向人群范围")
        @Size(max = 500, message = "面向人群范围不超过 500 字")
        String targetScope,

        @NotNull(message = "请填写计划开始日期")
        LocalDate planStartDate,

        @NotNull(message = "请填写计划结束日期")
        LocalDate planEndDate,

        @Positive(message = "计划场次数必须大于 0")
        Integer planSessionCount,

        @Size(max = 1000, message = "备注不超过 1000 字")
        String remark) {
}
