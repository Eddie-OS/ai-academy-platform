package com.aiacademy.business.course.service;

import com.aiacademy.business.course.domain.Course;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseTrial;
import com.aiacademy.business.course.domain.CourseTrialConclusionForm;
import com.aiacademy.business.course.domain.CourseTrialForm;
import com.aiacademy.business.course.repository.CourseMapper;
import com.aiacademy.business.course.repository.CourseTrialMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.common.json.JsonArrays;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import com.aiacademy.platform.storage.service.AttachmentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 试讲记录（需求 9.7）。每轮产出<b>两个独立结论</b>：课程试讲结论与讲师试讲结论（议题 17）。
 *
 * <p><b>结论不一致不是错误。</b>系统只置标记（数据库生成列）并在界面提示，不做任何自动处置
 * （需求 9.7.3）。这里没有「两个结论必须一致」的校验，也没有「不一致就不让保存」的分支——
 * 加了就等于让系统替线下评审会做判断。
 */
@Service
public class CourseTrialService {

    /** 试讲附件（录像、评分表）在 {@code sys_attachment_ref} 上的字段名。 */
    private static final String REF_FIELD = "trial_files";

    private final CourseTrialMapper trials;
    private final CourseMapper courses;
    private final AttachmentService attachments;
    private final StateMachineRegistry stateMachines;

    public CourseTrialService(CourseTrialMapper trials, CourseMapper courses,
                              AttachmentService attachments, StateMachineRegistry stateMachines) {
        this.trials = trials;
        this.courses = courses;
        this.attachments = attachments;
        this.stateMachines = stateMachines;
    }

    /**
     * 新开一轮试讲（需求 9.7.1 第 3 项：轮次 = 已有记录数 + 1）。
     *
     * <p>与评审记录不同，试讲记录<b>由运营手工创建</b>：课程主状态进入「试讲」只置子状态与派生
     * 任务，没有「自动建一条试讲记录」的副作用（需求 5.3.1 第 5 行）。一门课程试讲几次由线下
     * 安排决定。
     *
     * <p>讲师是否存在由调用方在 app 层校验——业务模块之间不得直接依赖（AR-1）。
     */
    @Transactional
    public long createRound(long courseId, CourseTrialForm form) {
        if (courses.lockById(courseId) == null) {
            throw new NotFoundException("课程不存在或已删除：" + courseId);
        }
        String operator = OperatorContext.current().account().name();
        int roundNo = trials.nextRoundNo(courseId);

        long trialId = trials.insert(courseId, roundNo, form.trialDate(), form.lecturerId(),
                form.participants(), pendingState(), operator);
        linkAttachments(trialId, form.attachmentIds());
        return trialId;
    }

    /**
     * 录入双结论与意见。只写字段，记录状态与课程主状态由调用方按状态机推进。
     *
     * <p>验收标准的取值随课程的评审轨道走（需求 9.7.2），所以要先把课程读出来。
     */
    @Transactional
    public void recordConclusion(long trialId, CourseTrialConclusionForm form) {
        CourseTrial trial = require(trialId);
        Course course = courses.selectById(trial.courseId());
        if (course == null) {
            throw new NotFoundException("课程不存在或已删除：" + trial.courseId());
        }
        checkEnums(form, course.getReviewTrack());

        int updated = trials.recordConclusion(trialId,
                JsonArrays.toJson(form.acceptanceChecks()),
                form.courseConclusion(),
                form.lecturerConclusion(),
                form.expertOpinion(),
                form.issueList(),
                OperatorContext.current().account().name(),
                pendingState());
        if (updated == 0) {
            // 同评审记录：同一份结论再提交一次是双击（K2），换一份结论是在改历史（需求 9.8）
            if (form.courseConclusion().equals(trial.courseConclusion())
                    && form.lecturerConclusion().equals(trial.lecturerConclusion())) {
                throw new BizException(ErrorCode.DUPLICATE_SUBMIT,
                        ErrorCode.DUPLICATE_SUBMIT.defaultMessage());
            }
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "第 %d 轮试讲记录已录入结论，历史试讲记录不允许修改（需求 9.8）"
                            .formatted(trial.roundNo()));
        }
    }

    @Transactional(readOnly = true)
    public List<CourseTrial> listByCourse(long courseId) {
        return trials.findByCourse(courseId);
    }

    @Transactional(readOnly = true)
    public CourseTrial require(long trialId) {
        CourseTrial trial = trials.findById(trialId);
        if (trial == null) {
            throw new NotFoundException("试讲记录不存在或已删除：" + trialId);
        }
        return trial;
    }

    /**
     * 试讲记录的初始状态「待录入结论」，从状态机的「（空）→ 新建试讲记录」这条转换取。
     *
     * <p>同时用作录入结论时 UPDATE 的 WHERE 条件（需求 9.8：已录结论的记录只读）。理由同评审记录：
     * 状态值不写死在业务代码与 SQL 里（出口准则 E2-6）。
     */
    private String pendingState() {
        return stateMachines.require(CourseRecordStateMachines.TRIAL_OBJECT_TYPE,
                CourseRecordStateMachines.FIELD_TRIAL_STATE, null,
                CourseRecordStateMachines.ACTION_CREATE_TRIAL).to();
    }

    private void linkAttachments(long trialId, List<Long> attachmentIds) {
        if (attachmentIds == null) {
            return;
        }
        int seqNo = 0;
        for (Long attachmentId : attachmentIds) {
            attachments.link(attachmentId, AttachmentOwnerType.COURSE_TRIAL, trialId, REF_FIELD, seqNo++);
        }
    }

    /**
     * 校验取值范围。验收标准按评审轨道取不同的一组（需求 9.7.2），勾了另一条轨道的项目是错的——
     * 那说明前端拿错了轨道，保存下来会让「内部端到端课程」的试讲记录里出现只有周边课程才有的验收项。
     */
    private static void checkEnums(CourseTrialConclusionForm form, String reviewTrack) {
        requireConclusion("课程试讲结论", form.courseConclusion());
        requireConclusion("讲师试讲结论", form.lecturerConclusion());
        if (form.acceptanceChecks() == null) {
            return;
        }
        List<String> allowed = CourseEnums.ACCEPTANCE_CHECKS.getOrDefault(reviewTrack, List.of());
        for (String check : form.acceptanceChecks()) {
            if (!allowed.contains(check)) {
                throw new BizException(ErrorCode.PARAM_INVALID,
                        "「%s」的验收标准只有 %s，收到「%s」".formatted(reviewTrack, allowed, check));
            }
        }
    }

    private static void requireConclusion(String label, String value) {
        if (!CourseEnums.TRIAL_CONCLUSIONS.contains(value)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "%s只能是 %s，收到「%s」".formatted(label, CourseEnums.TRIAL_CONCLUSIONS, value));
        }
    }
}
