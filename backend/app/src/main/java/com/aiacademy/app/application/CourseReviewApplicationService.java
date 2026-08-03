package com.aiacademy.app.application;

import com.aiacademy.business.course.domain.CourseReviewForm;
import com.aiacademy.business.course.service.CourseReviewService;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 录入评审结论的编排（AR-4）：写业务字段 + 推进记录状态，而记录状态的副作用又会驱动课程主状态。
 *
 * <p>三件事必须在同一个事务里（需求 5.5）。分开做会产生「结论录进去了但课程还停在评审决策」的
 * 数据，而这种课程在列表上看不出异常——它只是永远停在那里，直到红灯响起才有人去查。
 *
 * <p>顺序是<b>先写字段、后转状态</b>：驱动课程主状态的副作用要读回评审结果才知道课程该去哪个
 * 状态（需求 5.5 的结论 → 状态对应表），字段还没落库时它读到的是 NULL。
 */
@Service
public class CourseReviewApplicationService {

    private final CourseReviewService reviews;
    private final TransitionApplicationService transitions;

    public CourseReviewApplicationService(CourseReviewService reviews,
                                          TransitionApplicationService transitions) {
        this.reviews = reviews;
        this.transitions = transitions;
    }

    @Transactional
    public void recordConclusion(long reviewId, CourseReviewForm form) {
        reviews.recordConclusion(reviewId, form);
        transitions.transit(new TransitCommand(
                CourseRecordStateMachines.REVIEW_OBJECT_TYPE, reviewId,
                CourseRecordStateMachines.FIELD_REVIEW_STATE,
                CourseRecordStateMachines.ACTION_RECORD_RESULT,
                null, "录入评审结果：" + form.reviewResult()));
    }
}
