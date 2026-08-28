package com.aiacademy.business.course.domain;

import java.time.LocalDate;

/**
 * 课程工作台「试讲日历」上的一条试讲。
 *
 * <p>来源有两路：官方试讲记录的 {@code trial_date}，以及试讲台账的 {@code trial_scheduled_date}。
 * 同一天同一门课只保留官方记录，避免右侧出现两条。
 *
 * @param lecturerId   官方记录的讲师池主键；台账行没有这一列
 * @param lecturerName 已解析的姓名。官方记录由 app 层补；台账行来自人员台账
 * @param roundNo      官方记录轮次号；台账行用 {@code roundLabel}
 */
public record CourseTrialCalendarItem(
        LocalDate trialDate,
        Long courseId,
        String courseName,
        Integer roundNo,
        String roundLabel,
        Long lecturerId,
        String lecturerName,
        String audienceCount) {
}
