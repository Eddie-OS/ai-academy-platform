package com.aiacademy.app.application.effect;

import com.aiacademy.business.training.service.TrainingPlanService;
import com.aiacademy.platform.statemachine.domain.Effect;
import org.springframework.stereotype.Component;

/**
 * 培训计划的唯一副作用：首次进入「已完成」时写实际完成时间（需求 5.7 第 3 行、11.3 第 12 项）。
 *
 * <p>「首次」是靠 SQL 的 {@code COALESCE} 保证的，不是靠这里判断——计划可以退回执行中再次完成，
 * 转换表明确要求实际完成时间保留不清空。放在 SQL 侧还能扛住并发：两次「全部场次结束」同时到达时
 * 也只有一个值能留下。
 */
@Component
public class TrainingPlanEffectHandler implements EffectHandler {

    private final TrainingPlanService plans;

    public TrainingPlanEffectHandler(TrainingPlanService plans) {
        this.plans = plans;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.SET_ACTUAL_FINISHED_AT.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        plans.markFinished(context.objectId());
    }
}
