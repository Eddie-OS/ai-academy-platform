package com.aiacademy.app.application;

import com.aiacademy.app.repository.CourseRefMapper;
import com.aiacademy.app.repository.LecturerLookupMapper;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.training.domain.TrainingPlanForm;
import com.aiacademy.business.training.domain.TrainingSession;
import com.aiacademy.business.training.domain.TrainingSessionForm;
import com.aiacademy.business.training.service.TrainingPlanService;
import com.aiacademy.business.training.service.TrainingSessionService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 培训里需要跨模块协作的动作（AR-4：跨模块编排放 app 层）。
 *
 * <p>培训计划与场次都指向课程与讲师，而那是另外两个业务模块的对象——存在性校验、名称补齐都
 * 只能在这一层做。纯粹落在培训自己表上的读写不经过这里，Controller 直接调
 * {@code TrainingPlanService}。
 */
@Service
public class TrainingApplicationService {

    private final TrainingPlanService plans;
    private final TrainingSessionService sessions;
    private final CourseRefMapper courses;
    private final LecturerLookupMapper lecturers;
    private final SchedulingValidator scheduling;
    private final TransitionApplicationService transitions;

    public TrainingApplicationService(TrainingPlanService plans, TrainingSessionService sessions,
                                      CourseRefMapper courses, LecturerLookupMapper lecturers,
                                      SchedulingValidator scheduling,
                                      TransitionApplicationService transitions) {
        this.plans = plans;
        this.sessions = sessions;
        this.courses = courses;
        this.lecturers = lecturers;
        this.scheduling = scheduling;
        this.transitions = transitions;
    }

    /**
     * 新建培训计划：INSERT 之后补记「（空）→ 待执行」的流转日志。
     *
     * <p>两步同事务。补记失败则计划一并回滚——一条没有创建时刻的计划会让状态流转日志缺掉起点。
     *
     * <p><b>这里只校验课程存在，不校验课程是否已发布。</b>V1.2 把「课程可发布」这项校验移到了
     * 场次创建时（需求 11.3 第 3 项、11.4.1 校验二）：计划常常在课程还没发布时就先排上了，
     * 在计划这一级拦下来会逼运营等课程发布后再补录计划，而那时计划的开始日期已经过去了。
     */
    @Transactional
    public long createPlan(TrainingPlanForm form) {
        requireCourse(form.courseId());
        long id = plans.create(form);
        transitions.initialize(TrainingStateMachines.PLAN_OBJECT_TYPE, id,
                TrainingStateMachines.FIELD_PLAN_STATE, TrainingStateMachines.ACTION_CREATE_PLAN);
        return id;
    }

    @Transactional
    public void updatePlan(long id, TrainingPlanForm form) {
        requireCourse(form.courseId());
        plans.update(id, form);
    }

    /** 批量取课程名称，给列表页补 {@code courseName} 列。查不到的课程不出现在 Map 里。 */
    @Transactional(readOnly = true)
    public Map<Long, String> courseNames(Collection<Long> courseIds) {
        Set<Long> ids = courseIds.stream().filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (ids.isEmpty()) {
            return Map.of();
        }
        return courses.findByIds(ids).stream()
                .collect(Collectors.toMap(CourseRefMapper.CourseRef::id,
                        CourseRefMapper.CourseRef::courseName, (a, b) -> a));
    }

    /** 批量取课程简介（立项大纲摘要），给日历日视图补「课程介绍」。 */
    @Transactional(readOnly = true)
    public Map<Long, String> courseIntros(Collection<Long> courseIds) {
        Set<Long> ids = courseIds.stream().filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (ids.isEmpty()) {
            return Map.of();
        }
        return courses.findByIds(ids).stream()
                .filter(ref -> ref.outlineSummary() != null && !ref.outlineSummary().isBlank())
                .collect(Collectors.toMap(CourseRefMapper.CourseRef::id,
                        CourseRefMapper.CourseRef::outlineSummary, (a, b) -> a));
    }

    // -------------------------------------------------------------------------
    // 培训场次（需求 11.4、11.4.1）
    // -------------------------------------------------------------------------

    /**
     * 在计划下新建场次：INSERT → 推进「（空）→ 待开课」（这一跳执行排课两项硬阻断校验并补记
     * 流转日志）→ 算出非阻断提示随响应返回。
     *
     * <p>三步同事务。硬阻断在状态转换的副作用里抛出，整笔回滚——不会留下一个「建出来了但讲师
     * 还没到可上岗」的场次。
     */
    @Transactional
    public SessionSaved createSession(long planId, TrainingSessionForm form) {
        long id = sessions.create(planId, form);
        transitions.initialize(TrainingStateMachines.SESSION_OBJECT_TYPE, id,
                TrainingStateMachines.FIELD_SESSION_STATE,
                TrainingStateMachines.ACTION_CREATE_SESSION);
        return new SessionSaved(id, warningsOf(form, id));
    }

    /**
     * 编辑场次。
     *
     * <p><b>编辑同样要跑排课校验</b>（需求 11.4.1 落地要点第 2 条：创建、改讲师、改课程、改日期
     * 或时间四种操作都要重新校验）。只在创建时校验，改成一个培养中的讲师就能绕过去，而那正是
     * 校验一要防的事。
     */
    @Transactional
    public SessionSaved updateSession(long id, TrainingSessionForm form) {
        scheduling.requireSchedulable(form.courseId(), form.lecturerId());
        sessions.update(id, form);
        return new SessionSaved(id, warningsOf(form, id));
    }

    /**
     * 日历页拖动改期（需求 11.8）：只改培训日期。
     *
     * <p>讲师与课程没变，两项硬阻断校验按落地要点第 5 条<b>不回溯</b>已排的场次；但时段冲突要
     * 重新算——拖到另一天正是可能撞上别的场次的操作。
     */
    @Transactional
    public SessionSaved reschedule(long id, LocalDate trainingDate) {
        TrainingSession session = sessions.require(id);
        sessions.reschedule(id, trainingDate);
        return new SessionSaved(id, scheduling.warnings(session.getCourseId(),
                session.getLecturerId(), trainingDate,
                session.getStartTime(), session.getEndTime(), id));
    }

    /** 保存前的预检，供前端在提交之前弹二次确认（需求 11.4.1 校验三的「确认继续？」）。 */
    @Transactional(readOnly = true)
    public List<String> checkScheduling(Long courseId, long lecturerId, LocalDate trainingDate,
                                        LocalTime startTime, LocalTime endTime,
                                        Long excludeSessionId) {
        return scheduling.warnings(courseId, lecturerId, trainingDate, startTime, endTime,
                excludeSessionId == null ? 0L : excludeSessionId);
    }

    /** 批量取讲师姓名，给场次列表与日历卡片补讲师列。 */
    @Transactional(readOnly = true)
    public Map<Long, String> lecturerNames(Collection<Long> lecturerIds) {
        Set<Long> ids = lecturerIds.stream().filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (ids.isEmpty()) {
            return Map.of();
        }
        return lecturers.findRefsByIds(ids).stream()
                .collect(Collectors.toMap(LecturerLookupMapper.LecturerRef::id,
                        LecturerLookupMapper.LecturerRef::lecturerName, (a, b) -> a));
    }

    /**
     * 新建场次时的课程与讲师候选（需求 11.4.1 落地要点第 4 条）。
     *
     * <p>下拉里只列<b>能排</b>的：讲师限「可上岗」，课程限已发布之后的三个主状态。这不是把
     * 校验挪到前端——两项硬阻断照常在保存时执行（{@link SchedulingValidator}），
     * 这里只是免得运营选完才被拒。
     */
    @Transactional(readOnly = true)
    public SchedulingOptions schedulingOptions(String keyword) {
        String like = keyword == null || keyword.isBlank() ? null
                : "%" + keyword.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return new SchedulingOptions(
                courses.findSchedulable(CourseStateMachines.MAIN_STATES_SCHEDULABLE, like),
                lecturers.schedulableOptions(LecturerEnums.TRAINING_QUALIFIED));
    }

    public record SchedulingOptions(List<CourseRefMapper.CourseRef> courses,
                                    List<LecturerLookupMapper.LecturerOption> lecturers) {
    }

    private List<String> warningsOf(TrainingSessionForm form, long sessionId) {
        return scheduling.warnings(form.courseId(), form.lecturerId(), form.trainingDate(),
                form.startTime(), form.endTime(), sessionId);
    }

    /**
     * 场次保存的结果。
     *
     * @param warnings 非阻断提示（时段冲突、课程已过期）。<b>有提示不代表没保存成功</b>——
     *                 前端按提示条展示即可，不要当成失败处理
     */
    public record SessionSaved(long id, List<String> warnings) {
    }

    private void requireCourse(Long courseId) {
        if (courseId == null || courses.findById(courseId) == null) {
            throw new BizException(ErrorCode.PARAM_INVALID, "关联课程不存在或已删除：" + courseId);
        }
    }

    /** 给 Controller 用的小工具：把一页记录里的课程 ID 收集起来一次查完。 */
    public <T> Map<Long, String> courseNamesOf(Collection<T> rows, Function<T, Long> courseIdOf) {
        return courseNames(rows.stream().map(courseIdOf).toList());
    }
}
