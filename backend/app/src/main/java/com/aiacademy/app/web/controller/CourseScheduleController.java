package com.aiacademy.app.web.controller;

import com.aiacademy.business.course.domain.CourseCalendarItem;
import com.aiacademy.business.course.domain.CourseSchedule;
import com.aiacademy.business.course.service.CourseScheduleService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * 课程排期（需求 9.9，页面 P2-4 课程排期日历）。
 */
@RestController
public class CourseScheduleController {

    private final CourseScheduleService schedules;

    public CourseScheduleController(CourseScheduleService schedules) {
        this.schedules = schedules;
    }

    /**
     * 日历数据。月视图与周视图共用一个接口，差别只在前端传的区间宽度。
     *
     * <p>返回的每一格里带课程名称、负责人、主状态、预计发布时间（需求 9.9 的展示字段），
     * 灯色恒为 null——三色灯统一在阶段 3 的 {@code aggregate/warning} 里算。
     */
    @GetMapping("/api/course-schedules/calendar")
    public R<List<CourseCalendarItem>> calendar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return R.ok(schedules.calendar(from, to));
    }

    @GetMapping("/api/courses/{courseId}/schedules")
    public R<List<CourseSchedule>> listByCourse(@PathVariable long courseId) {
        return R.ok(schedules.listByCourse(courseId));
    }

    @WriteApi
    @PostMapping("/api/courses/{courseId}/schedules")
    public R<Long> create(@PathVariable long courseId, @Valid @RequestBody CourseSchedule.Form form) {
        return R.ok(schedules.create(courseId, form));
    }

    @WriteApi
    @PutMapping("/api/course-schedules/{scheduleId}")
    public R<Void> update(@PathVariable long scheduleId, @Valid @RequestBody CourseSchedule.Form form) {
        schedules.update(scheduleId, form);
        return R.ok(null);
    }

    @WriteApi
    @DeleteMapping("/api/course-schedules/{scheduleId}")
    public R<Void> delete(@PathVariable long scheduleId) {
        schedules.delete(scheduleId);
        return R.ok(null);
    }
}
