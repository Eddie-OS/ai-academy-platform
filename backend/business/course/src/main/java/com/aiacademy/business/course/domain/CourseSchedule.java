package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 课程排期的一个计划节点（需求 9.9）。
 *
 * <p><b>课程排期不做任何校验。</b>需求 9.9 明说排课三项校验只作用于培训场次创建（11.4），
 * 课程排期本身不校验——这里排的是「什么时候完成初稿、什么时候提交评审」，没有资源冲突可言。
 *
 * @param planDate 计划日期。用 {@code DATE} 而不是时间戳：排期日历按自然日展示（开发 6.1.4），
 *                 带上时分秒会让「还剩几天」出现 ±1 天的偏差
 */
public record CourseSchedule(
        Long id,
        Long courseId,
        String nodeName,
        LocalDate planDate,
        String remark,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    /** 新建与编辑共用的表单。 */
    public record Form(
            @NotBlank(message = "请填写节点名称")
            @Size(max = 100, message = "节点名称不超过 100 字")
            String nodeName,

            @NotNull(message = "请选择计划日期")
            LocalDate planDate,

            @Size(max = 500, message = "备注不超过 500 字")
            String remark) {
    }
}
