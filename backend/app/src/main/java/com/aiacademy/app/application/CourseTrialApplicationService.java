package com.aiacademy.app.application;

import com.aiacademy.app.repository.LecturerLookupMapper;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseTrialConclusionForm;
import com.aiacademy.business.course.domain.CourseTrialForm;
import com.aiacademy.business.course.service.CourseTrialService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 试讲记录的编排（AR-4）：跨了课程、讲师与状态机三处。
 *
 * <p>放在 app 层的原因是<b>试讲讲师来自讲师池</b>（需求 9.7.1 第 5 项），而业务模块之间禁止直接
 * 依赖（AR-1）。课程模块不认识 {@code biz_lecturer}，讲师是否存在只能在这里查。
 */
@Service
public class CourseTrialApplicationService {

    private final CourseTrialService trials;
    private final TransitionApplicationService transitions;
    private final OptionalTransitionService optionalTransitions;
    private final LecturerLookupMapper lecturers;

    public CourseTrialApplicationService(CourseTrialService trials,
                                         TransitionApplicationService transitions,
                                         OptionalTransitionService optionalTransitions,
                                         LecturerLookupMapper lecturers) {
        this.trials = trials;
        this.transitions = transitions;
        this.optionalTransitions = optionalTransitions;
        this.lecturers = lecturers;
    }

    /**
     * 新开一轮试讲。
     *
     * <p><b>只校验讲师存在，不校验讲师的培养状态。</b>「讲师状态 = 可上岗」是<b>排课</b>的条件
     * （需求 C08、11.4），不是试讲的条件——恰恰相反，试讲往往就是把「培养中」的讲师推向「可上岗」
     * 的那一步。在这里加状态校验会把新讲师挡在试讲之外。
     */
    @Transactional
    public long createRound(long courseId, CourseTrialForm form) {
        requireLecturer(form.lecturerId());
        long trialId = trials.createRound(courseId, form);
        transitions.initialize(CourseRecordStateMachines.TRIAL_OBJECT_TYPE, trialId,
                CourseRecordStateMachines.FIELD_TRIAL_STATE,
                CourseRecordStateMachines.ACTION_CREATE_TRIAL);
        return trialId;
    }

    /**
     * 录入双结论（需求 9.7.1）。四件事在同一个事务里：
     *
     * <ol>
     *   <li>写结论字段；
     *   <li>推进试讲<b>子状态</b>（需求 5.4.3：试讲中 → 待发布 / 待试讲）。走不通就跳过——
     *       运营可能没点过「开始试讲」，而子状态是展示用的，不该拦住结论录入；
     *   <li>把记录状态推到「已完成」，其副作用按课程结论驱动课程主状态（需求 5.6）；
     *   <li>讲师试讲合格标记由副作用 {@code UPDATE_LECTURER_TRIAL_FLAG} 负责，属阶段 2 D 段。
     * </ol>
     *
     * <p>子状态排在主状态之前：主状态「试讲 → 发布」之后再回头推「试讲中 → 待发布」，读起来像是
     * 课程发布之后又回到了待发布。
     */
    @Transactional
    public void recordConclusion(long trialId, CourseTrialConclusionForm form) {
        trials.recordConclusion(trialId, form);

        long courseId = trials.require(trialId).courseId();
        String subStateAction = CourseEnums.trialActionOfCourseConclusion(form.courseConclusion());
        optionalTransitions.tryTransit(CourseStateMachines.OBJECT_TYPE, courseId,
                CourseStateMachines.FIELD_TRIAL_STATE, subStateAction,
                "录入试讲课程结论：" + form.courseConclusion());

        transitions.transit(new TransitCommand(
                CourseRecordStateMachines.TRIAL_OBJECT_TYPE, trialId,
                CourseRecordStateMachines.FIELD_TRIAL_STATE,
                CourseRecordStateMachines.ACTION_RECORD_RESULT,
                null, "录入试讲结论：课程 %s／讲师 %s"
                        .formatted(form.courseConclusion(), form.lecturerConclusion())));
    }

    private void requireLecturer(long lecturerId) {
        if (!lecturers.exists(lecturerId)) {
            throw new BizException(ErrorCode.PARAM_INVALID, "试讲讲师不存在或已删除：" + lecturerId);
        }
    }
}
