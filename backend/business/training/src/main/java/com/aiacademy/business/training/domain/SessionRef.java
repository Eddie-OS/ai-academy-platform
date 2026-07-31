package com.aiacademy.business.training.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * 培训场次的引用视图：导入校验只需要这几列。
 *
 * <p><b>为什么不用完整实体：</b>阶段 1 不实现培训场次的任何 CRUD（开发 8.5 硬约束），
 * 现在建一个 20 列的实体，到阶段 3 真正做场次页面时必然要重写；而导入校验要的只是
 * 「这个场次号存不存在、状态允不允许导、开始时间是什么」。
 *
 * @param sessionState 待开课 / 已开课 / 已结束 / 已归档。签到与两类反馈对它有不同的要求
 */
public record SessionRef(long id, String sessionNo, String sessionState,
                         LocalDate trainingDate, LocalTime startTime) {

    /**
     * 场次开始时刻。签到导入的「签到时间」留空时取它（需求 14.4 E 列）。
     *
     * <p>库里 {@code training_date} 是 DATE、{@code start_time} 是 TIME（都不带时区，开发 6.1.4：
     * 它们是「一天内的时刻」），落到带时区的 {@code attend_time} 需要补一个时区，取系统默认时区。
     * 一期是单机内网部署，系统时区就是业务时区。
     */
    public OffsetDateTime startAt() {
        return LocalDateTime.of(trainingDate, startTime).atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
