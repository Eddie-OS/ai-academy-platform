package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.TrainingApplicationService;
import com.aiacademy.app.web.dto.TrainingSessionVO;
import com.aiacademy.business.training.domain.TrainingSessionForm;
import com.aiacademy.business.training.domain.TrainingSessionListItem;
import com.aiacademy.business.training.domain.TrainingSessionQuery;
import com.aiacademy.business.training.service.TrainingSessionService;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * 培训场次列表、排期日历与详情（需求 11.4、11.8 P4-1／P4-4、11.9）。
 *
 * <p>写接口一律带 {@code @WriteApi}，判权由 {@code PermissionInterceptor} 一处完成（AR-7）。
 *
 * <p><b>新建场次挂在计划下</b>：{@code POST /api/training-plans/{planId}/sessions}。场次号是
 * 「计划号-序号」，脱离计划的场次不存在。其余操作按场次自己的 ID 走 {@code /api/training-sessions}。
 */
@RestController
@RequestMapping("/api")
public class TrainingSessionController {

    private final TrainingSessionService sessions;
    private final TrainingApplicationService application;

    public TrainingSessionController(TrainingSessionService sessions,
                                     TrainingApplicationService application) {
        this.sessions = sessions;
        this.application = application;
    }

    /**
     * 在计划下新建场次（需求 5.8 第 1 行）。
     *
     * <p>返回主键与<b>非阻断提示</b>：讲师时段冲突与课程已过期属于「提示不阻断」，保存已经成功，
     * 前端把 {@code warnings} 展示出来即可（需求 11.4.1 校验三、规则 EX6）。
     */
    @WriteApi
    @PostMapping("/training-plans/{planId}/sessions")
    public R<TrainingApplicationService.SessionSaved> create(
            @PathVariable long planId, @Valid @RequestBody TrainingSessionForm form) {
        return R.ok(application.createSession(planId, form));
    }

    @WriteApi
    @PutMapping("/training-sessions/{id}")
    public R<TrainingApplicationService.SessionSaved> update(
            @PathVariable long id, @Valid @RequestBody TrainingSessionForm form) {
        return R.ok(application.updateSession(id, form));
    }

    /** 日历页拖动改期（需求 11.8）。只改培训日期，时段冲突提示随响应返回。 */
    @WriteApi
    @PutMapping("/training-sessions/{id}/training-date")
    public R<TrainingApplicationService.SessionSaved> reschedule(
            @PathVariable long id,
            @RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate trainingDate) {
        return R.ok(application.reschedule(id, trainingDate));
    }

    @WriteApi
    @DeleteMapping("/training-sessions/{id}")
    public R<Void> delete(@PathVariable long id) {
        sessions.softDelete(id);
        return R.ok(null);
    }

    /**
     * 保存前的排课预检（需求 11.4.1 校验三）。
     *
     * <p>只返回<b>提示类</b>结果。两项硬阻断不在这里判——它们由保存时的状态转换副作用硬阻断，
     * 前端的讲师与课程下拉本来就只列出可选项（落地要点第 4 条）。
     */
    @GetMapping("/training-sessions/scheduling-check")
    public R<List<String>> schedulingCheck(
            @RequestParam Long courseId,
            @RequestParam long lecturerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate trainingDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime endTime,
            @RequestParam(required = false) Long excludeSessionId) {
        return R.ok(application.checkScheduling(
                courseId, lecturerId, trainingDate, startTime, endTime, excludeSessionId));
    }

    /**
     * 排课表单的课程与讲师候选（需求 11.4 第 3、5 项）。
     *
     * <p>合成一个接口是因为它们总是同时用：打开新建场次抽屉就要两份下拉。
     * {@code keyword} 只筛课程（讲师池是百人量级，一次给全）。
     */
    @GetMapping("/training-sessions/scheduling-options")
    public R<TrainingApplicationService.SchedulingOptions> schedulingOptions(
            @RequestParam(required = false) String keyword) {
        return R.ok(application.schedulingOptions(keyword));
    }

    /**
     * 场次列表与排期日历共用的查询（需求 11.9、11.8 P4-1）。
     *
     * <p>日历按月取数时传 {@code dateFrom}／{@code dateTo} 与一个大 {@code pageSize}：一个月的
     * 场次是几十条量级，不需要另开一套接口。
     */
    @GetMapping("/training-sessions")
    public R<PageResult<TrainingSessionVO>> list(TrainingSessionQuery query) {
        PageResult<TrainingSessionListItem> page = sessions.page(query);
        Map<Long, String> courseNames =
                application.courseNamesOf(page.records(), TrainingSessionListItem::getCourseId);
        Map<Long, String> courseIntros = application.courseIntros(
                page.records().stream().map(TrainingSessionListItem::getCourseId).toList());
        Map<Long, String> lecturerNames = application.lecturerNames(
                page.records().stream().map(TrainingSessionListItem::getLecturerId).toList());
        return R.ok(new PageResult<>(
                page.records().stream()
                        .map(s -> TrainingSessionVO.of(s, courseNames.get(s.getCourseId()),
                                courseIntros.get(s.getCourseId()),
                                lecturerNames.get(s.getLecturerId())))
                        .toList(),
                page.total(), page.pageNum(), page.pageSize()));
    }

    @GetMapping("/training-sessions/{id}")
    public R<TrainingSessionVO> detail(@PathVariable long id) {
        TrainingSessionListItem session = sessions.get(id);
        return R.ok(TrainingSessionVO.of(session,
                application.courseNames(List.of(session.getCourseId())).get(session.getCourseId()),
                application.courseIntros(List.of(session.getCourseId())).get(session.getCourseId()),
                application.lecturerNames(List.of(session.getLecturerId()))
                        .get(session.getLecturerId())));
    }
}
