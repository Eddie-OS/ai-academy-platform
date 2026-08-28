package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.CourseTrialApplicationService;
import com.aiacademy.app.repository.LecturerLookupMapper;
import com.aiacademy.app.web.dto.CourseTrialVO;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseTrial;
import com.aiacademy.business.course.domain.CourseTrialCalendarItem;
import com.aiacademy.business.course.domain.CourseTrialConclusionForm;
import com.aiacademy.business.course.domain.CourseTrialForm;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.business.course.service.CourseTrialService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * 试讲记录（需求 9.7，页面 P2-2 的试讲页签、P3-3 试讲台账）。
 *
 * <p>与评审记录一样：<b>没有编辑、没有删除</b>（需求 9.8）。要更正只能新开一轮并在意见里说明。
 * 区别在于试讲记录是运营手工新建的——课程进入「试讲」不会自动开一轮，试讲几次由线下安排决定。
 */
@RestController
public class CourseTrialController {

    private final CourseTrialService trials;
    private final CourseTrialApplicationService application;
    private final CourseService courses;
    private final LecturerLookupMapper lecturers;

    public CourseTrialController(CourseTrialService trials, CourseTrialApplicationService application,
                                 CourseService courses, LecturerLookupMapper lecturers) {
        this.trials = trials;
        this.application = application;
        this.courses = courses;
        this.lecturers = lecturers;
    }

    @GetMapping("/api/course-trials/calendar")
    public R<List<CourseTrialCalendarItem>> calendar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return R.ok(trials.calendar(from, to).stream().map(this::withLecturerName).toList());
    }

    @GetMapping("/api/courses/{courseId}/trials")
    public R<List<CourseTrialVO>> listByCourse(@PathVariable long courseId) {
        return R.ok(trials.listByCourse(courseId).stream().map(this::toVO).toList());
    }

    @GetMapping("/api/course-trials/{trialId}")
    public R<CourseTrialVO> detail(@PathVariable long trialId) {
        return R.ok(toVO(trials.require(trialId)));
    }

    /** 新开一轮试讲。轮次由系统算（需求 9.7.1 第 3 项）。 */
    @WriteApi
    @PostMapping("/api/courses/{courseId}/trials")
    public R<Long> createRound(@PathVariable long courseId, @Valid @RequestBody CourseTrialForm form) {
        return R.ok(application.createRound(courseId, form));
    }

    /**
     * 录入双结论（需求 9.7.1 第 7～12 项）。
     *
     * <p>课程结论驱动课程主状态，讲师结论驱动讲师的试讲合格标记，二者独立（议题 17）。
     * 结论不一致时<b>照常保存</b>，系统只置标记不做处置（需求 9.7.3）。
     */
    @WriteApi
    @PostMapping("/api/course-trials/{trialId}/conclusion")
    public R<Void> recordConclusion(@PathVariable long trialId,
                                    @Valid @RequestBody CourseTrialConclusionForm form) {
        application.recordConclusion(trialId, form);
        return R.ok(null);
    }

    /**
     * 试讲讲师的候选项（需求 9.7.1 第 5 项：从讲师池选）。
     *
     * <p>讲师池的完整列表页属阶段 2 D 段，这里只给选择器需要的字段。放在试讲这一组路径下，
     * 是为了让 D 段上线真正的 {@code /api/lecturers} 时能直接替换而不必先兼容一个半成品。
     */
    @GetMapping("/api/course-trials/lecturer-options")
    public R<List<LecturerLookupMapper.LecturerOption>> lecturerOptions() {
        return R.ok(lecturers.options());
    }

    /**
     * 该课程可选的验收标准（需求 9.7.2：按评审轨道动态展示）。
     *
     * <p>前端不能自己按轨道字符串去查表——那等于把「哪条轨道有哪几项」抄一份到前端（纪律 STK-1）。
     */
    @GetMapping("/api/courses/{courseId}/trials/acceptance-checks")
    public R<List<String>> acceptanceChecks(@PathVariable long courseId) {
        String track = courses.get(courseId).getReviewTrack();
        return R.ok(CourseEnums.ACCEPTANCE_CHECKS.getOrDefault(track, List.of()));
    }

    private CourseTrialVO toVO(CourseTrial trial) {
        return CourseTrialVO.of(trial, lecturers.nameOf(trial.lecturerId()));
    }

    private CourseTrialCalendarItem withLecturerName(CourseTrialCalendarItem item) {
        if (item.lecturerName() != null || item.lecturerId() == null) {
            return item;
        }
        return new CourseTrialCalendarItem(
                item.trialDate(), item.courseId(), item.courseName(),
                item.roundNo(), item.roundLabel(), item.lecturerId(),
                lecturers.nameOf(item.lecturerId()), item.audienceCount());
    }
}
