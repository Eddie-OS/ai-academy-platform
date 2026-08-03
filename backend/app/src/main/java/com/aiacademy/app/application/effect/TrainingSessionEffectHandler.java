package com.aiacademy.app.application.effect;

import com.aiacademy.app.application.SchedulingValidator;
import com.aiacademy.business.training.domain.TrainingSession;
import com.aiacademy.business.training.service.TrainingPlanService;
import com.aiacademy.business.training.service.TrainingSessionService;
import com.aiacademy.platform.statemachine.domain.Effect;
import org.springframework.stereotype.Component;

/**
 * 创建培训场次时的两个副作用（需求 5.8 第 1 行）：挂到计划下、执行排课三项校验。
 *
 * <p>{@code VALIDATE_SCHEDULING} 是 <b>C9 允许的三处业务前置校验之一</b>，细节见
 * {@link SchedulingValidator}。校验放在副作用里而不是 Controller，是为了让统一转换接口
 * （{@code POST /api/training-sessions/{id}/transitions}）也拦得住；副作用抛异常时整笔事务回滚，
 * 状态列与流转日志一起退回，符合 C3 的硬阻断要求。
 *
 * <p>只做两项硬阻断。第三项（讲师时段冲突）是提示，不能在这里抛异常——它由应用服务在保存后
 * 算出来随响应返回。
 */
@Component
public class TrainingSessionEffectHandler implements EffectHandler {

    private final TrainingSessionService sessions;
    private final TrainingPlanService plans;
    private final SchedulingValidator scheduling;

    public TrainingSessionEffectHandler(TrainingSessionService sessions, TrainingPlanService plans,
                                        SchedulingValidator scheduling) {
        this.sessions = sessions;
        this.plans = plans;
        this.scheduling = scheduling;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.ATTACH_TO_PLAN.equals(effectCode)
                || Effect.VALIDATE_SCHEDULING.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        TrainingSession session = sessions.require(context.objectId());
        if (Effect.ATTACH_TO_PLAN.equals(effectCode)) {
            // plan_id 在 INSERT 时就落库了（列是 NOT NULL 且有外键），这里复核的是「计划没有被
            // 逻辑删除」——外键拦不住逻辑删除，而挂在已删计划下的场次没有任何页面入口
            plans.require(session.getPlanId());
            return;
        }
        scheduling.requireSchedulable(session.getCourseId(), session.getLecturerId());
    }
}
