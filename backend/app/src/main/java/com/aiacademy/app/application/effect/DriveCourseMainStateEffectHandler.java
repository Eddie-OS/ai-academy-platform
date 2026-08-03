package com.aiacademy.app.application.effect;

import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseReview;
import com.aiacademy.business.course.domain.CourseTrial;
import com.aiacademy.business.course.service.CourseReviewService;
import com.aiacademy.business.course.service.CourseTrialService;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * 副作用 {@code DRIVE_COURSE_MAIN_STATE}：录入结论后驱动课程主状态（需求 5.5、5.6）。
 *
 * <p>两种来源，各有各的对应表：评审结论按需求 5.5，试讲的<b>课程结论</b>按需求 5.3.1 第 9／10 行。
 * 两张表都写在 {@link CourseEnums} 里，这里只负责把它们接到状态机上。
 *
 * <p><b>试讲的讲师结论不在这里。</b>议题 17：两个结论互不影响——课程主状态只看课程结论，
 * 讲师标记只看讲师结论（副作用 {@code UPDATE_LECTURER_TRIAL_FLAG}，属讲师模块）。
 * 把两者合起来判断，等于让系统替线下评审会做处置，而需求 9.7.3 明说系统无任何自动处置。
 *
 * <p><b>驱动失败必须让整笔操作回滚。</b>课程不在预期状态时状态机抛 {@code ILLEGAL_TRANSITION}
 * （规则 C3 硬阻断）。吞掉它只会留下一条「已完成、结论合格」的记录挂在一门状态对不上的课程上，
 * 而且没有任何痕迹说明为什么状态没跟着走。
 */
@Component
public class DriveCourseMainStateEffectHandler implements EffectHandler {

    private static final Logger log = LoggerFactory.getLogger(DriveCourseMainStateEffectHandler.class);

    private final CourseReviewService reviews;
    private final CourseTrialService trials;
    private final TransitionApplicationService transitions;

    /** {@code @Lazy} 的理由同 {@link CreateReviewRoundEffectHandler}：副作用引发二次转换会成环。 */
    public DriveCourseMainStateEffectHandler(CourseReviewService reviews,
                                             CourseTrialService trials,
                                             @Lazy TransitionApplicationService transitions) {
        this.reviews = reviews;
        this.trials = trials;
        this.transitions = transitions;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.DRIVE_COURSE_MAIN_STATE.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        switch (context.objectType()) {
            case CourseRecordStateMachines.REVIEW_OBJECT_TYPE -> driveByReview(context);
            case CourseRecordStateMachines.TRIAL_OBJECT_TYPE -> driveByTrial(context);
            default -> throw new IllegalStateException(
                    "DRIVE_COURSE_MAIN_STATE 只用于评审记录与试讲记录，收到 " + context.objectType());
        }
    }

    private void driveByReview(EffectContext context) {
        CourseReview review = reviews.require(context.objectId());
        String action = CourseEnums.mainStateActionOfReviewResult(review.reviewResult());
        drive(review.courseId(), action,
                "第 %d 轮评审结论：%s".formatted(review.roundNo(), review.reviewResult()));
        log.info("评审记录 {}（课程 {} 第 {} 轮）结论「{}」，课程主状态执行动作 {}",
                context.objectId(), review.courseId(), review.roundNo(), review.reviewResult(), action);
    }

    private void driveByTrial(EffectContext context) {
        CourseTrial trial = trials.require(context.objectId());
        String action = CourseEnums.trialActionOfCourseConclusion(trial.courseConclusion());
        drive(trial.courseId(), action,
                "第 %d 轮试讲课程结论：%s".formatted(trial.roundNo(), trial.courseConclusion()));
        log.info("试讲记录 {}（课程 {} 第 {} 轮）课程结论「{}」、讲师结论「{}」，课程主状态执行动作 {}",
                context.objectId(), trial.courseId(), trial.roundNo(), trial.courseConclusion(),
                trial.lecturerConclusion(), action);
    }

    /**
     * 不传版本号：这是同一次操作内的连锁转换，运营手上那个版本号已经用在记录那一步了。
     * 并发安全由课程行的 FOR UPDATE 兜住。
     */
    private void drive(long courseId, String action, String remark) {
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, courseId,
                CourseStateMachines.FIELD_MAIN_STATE, action, null, remark));
    }
}
