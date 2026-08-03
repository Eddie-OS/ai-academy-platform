package com.aiacademy.app.application.effect;

import com.aiacademy.app.application.LecturerApplicationService;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseTrial;
import com.aiacademy.business.course.service.CourseTrialService;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import org.springframework.stereotype.Component;

/**
 * 副作用 {@code UPDATE_LECTURER_TRIAL_FLAG}：录入试讲双结论后，按<b>讲师结论</b>更新讲师的
 * 试讲合格标记与首次试讲合格时间（需求 5.6 第 2 条、10.3 第 9／10 项）。
 *
 * <p>三条容易做错的地方：
 * <ul>
 *   <li><b>看的是讲师结论，不是课程结论。</b>两者相互独立（议题 17）：一轮试讲完全可能课程合格
 *       而讲师不合格。拿课程结论去置讲师标记，会让一位没通过的讲师因为课件做得好而变成「已合格」。
 *   <li><b>不合格时什么都不做，不回退标记。</b>试讲合格标记的语义是「存在任一条讲师结论=合格的
 *       试讲记录」（需求 10.3 第 9 项），一次不合格不能抹掉之前合格过的事实。
 *   <li><b>不改培养状态</b>（规则 TS5）。合格了系统只在界面提示，是否「可上岗」由运营判断——
 *       原则一，决策在线下。
 * </ul>
 *
 * <p>首次试讲合格时间取<b>试讲日期</b>而不是录入当天：试讲是线下发生的事，结论可以隔几天才补录，
 * 用录入时间会让「首次合格」这个事实的时间点跟着运营什么时候有空而变。
 */
@Component
public class LecturerTrialFlagEffectHandler implements EffectHandler {

    private final CourseTrialService trials;
    private final LecturerApplicationService lecturers;

    public LecturerTrialFlagEffectHandler(CourseTrialService trials,
                                          LecturerApplicationService lecturers) {
        this.trials = trials;
        this.lecturers = lecturers;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.UPDATE_LECTURER_TRIAL_FLAG.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (!CourseRecordStateMachines.TRIAL_OBJECT_TYPE.equals(context.objectType())) {
            throw new IllegalStateException("UPDATE_LECTURER_TRIAL_FLAG 只用于试讲记录，收到 "
                    + context.objectType());
        }
        CourseTrial trial = trials.require(context.objectId());
        if (!CourseEnums.CONCLUSION_QUALIFIED.equals(trial.lecturerConclusion())) {
            return;
        }
        lecturers.markTrialQualified(trial.lecturerId(), trial.trialDate());
    }
}
