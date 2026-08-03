package com.aiacademy.app.application.effect;

import com.aiacademy.business.demand.service.DemandReviewService;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.Effect;
import org.springframework.stereotype.Component;

/**
 * 分流出口的两个副作用（需求 5.2.1 第 3、5 条）。
 *
 * <p>{@code REQUIRE_OUTLET} 是<b>复核</b>而不是补写：出口随评审结论一起落库（两者必须同时成功，
 * 见 {@code DemandApplicationService.recordReviewConclusion}），这里读回来确认它真的在。
 * 登记一个只做复核的处理器，等于把「评审结束必须有出口」这条约束钉在状态机这一侧——
 * 有人日后加了一条绕过评审结论接口、直接调统一转换接口把需求推到「已评审」的路径时，这里当场
 * 拒绝，而不是让一条永远推不动的需求静静躺在列表里。
 *
 * <p>「已评审但没有出口」的需求在界面上没有任何异常表现：状态列写着「已评审」，当前处理状态列
 * 是个「—」，而它<b>没有任何可执行动作</b>——解决方案与需求开发两组状态都还没被激活。运营只会
 * 觉得这条需求「卡住了」。
 */
@Component
public class DemandOutletEffectHandler implements EffectHandler {

    private final DemandService demands;
    private final DemandReviewService reviews;

    public DemandOutletEffectHandler(DemandService demands, DemandReviewService reviews) {
        this.demands = demands;
        this.reviews = reviews;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.REQUIRE_OUTLET.equals(effectCode)
                || Effect.CONFIRM_CLEAR_OUTLET.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (Effect.REQUIRE_OUTLET.equals(effectCode)) {
            requireOutlet(context);
            return;
        }
        reviews.clearOutlet(context.objectId());
    }

    private void requireOutlet(EffectContext context) {
        String outlet = demands.require(context.objectId()).getOutlet();
        if (outlet == null || outlet.isBlank()) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "录入评审结论时必须同时选择分流出口，请改用「录入评审结论」录入");
        }
    }
}
