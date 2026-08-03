package com.aiacademy.app.application.effect;

import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.business.course.service.CourseReviewService;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * 副作用 {@code CREATE_REVIEW_ROUND}：课程提交评审时开一轮评审记录（需求 5.3.1、9.6.1）。
 *
 * <p>评审记录<b>只能由课程状态转换产生</b>，没有对外的「新建评审记录」接口：轮次是「已有记录数
 * + 1」，手工建一条就会出现课程还在开发、却已经有第 3 轮评审记录的数据。
 *
 * <p>新记录的初始状态走 {@code initialize}，与课程创建同一套做法——记录状态是需求 5.5 的一个
 * 状态机，「（空）→ 待录入结论」这一步也要进流转日志。
 */
@Component
public class CreateReviewRoundEffectHandler implements EffectHandler {

    private static final Logger log = LoggerFactory.getLogger(CreateReviewRoundEffectHandler.class);

    private final CourseReviewService reviews;
    private final TransitionApplicationService transitions;

    /**
     * {@code @Lazy}：本处理器由 {@link EffectDispatcher} 持有，而 {@code EffectDispatcher} 又是
     * {@link TransitionApplicationService} 的依赖，构造期直接注入会成环。副作用触发的二次转换
     * 天然是这个形状（课程转换 → 建评审记录 → 评审记录自己的初始转换）。
     */
    public CreateReviewRoundEffectHandler(CourseReviewService reviews,
                                          @Lazy TransitionApplicationService transitions) {
        this.reviews = reviews;
        this.transitions = transitions;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.CREATE_REVIEW_ROUND.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (!CourseStateMachines.OBJECT_TYPE.equals(context.objectType())) {
            throw new IllegalStateException("CREATE_REVIEW_ROUND 只用于课程，收到 " + context.objectType());
        }
        long reviewId = reviews.createRound(context.objectId());
        transitions.initialize(CourseRecordStateMachines.REVIEW_OBJECT_TYPE, reviewId,
                CourseRecordStateMachines.FIELD_REVIEW_STATE,
                CourseRecordStateMachines.ACTION_CREATE_BY_COURSE_SUBMIT);
        log.info("课程 {} 因「{}」新开评审记录 {}", context.objectId(),
                context.transition().actionLabel(), reviewId);
    }
}
