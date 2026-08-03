package com.aiacademy.business.course.domain;

import java.time.LocalDate;

/**
 * 课程排期日历上的一格（需求 9.9，页面 P2-4）。
 *
 * <p>日历上有<b>两类事件</b>：运营自己排的开发节点，以及课程的预计发布时间。需求 9.9 的排期
 * 对象原文就是「课程的计划开发节点<b>与</b>计划发布时间」，只画节点会让日历上看不到最重要的
 * 那个日期。
 *
 * @param eventType {@link #EVENT_NODE} 或 {@link #EVENT_EXPECT_PUBLISH}
 * @param scheduleId 排期节点的主键；预计发布时间那一类为 null（它是课程主表上的字段，不是排期行）
 * @param warningLight 灯色。需求 9.9 的展示字段之一，<b>阶段 3 才算</b>——三色灯的阈值配置与
 *                     判定统一在 {@code aggregate/warning}，这里提前算一遍会出现两套判定
 */
public record CourseCalendarItem(
        Long courseId,
        String courseNo,
        String courseName,
        String ownerNo,
        String ownerName,
        String mainState,
        LocalDate expectPublishDate,
        String eventType,
        LocalDate eventDate,
        String nodeName,
        Long scheduleId,
        String warningLight) {

    public static final String EVENT_NODE = "开发节点";
    public static final String EVENT_EXPECT_PUBLISH = "预计发布";
}
