package com.aiacademy.app.application.effect;

import com.aiacademy.business.demand.service.DemandAcceptanceService;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * 交付与归档的三个副作用（需求 5.2.5 的两张表）：写交付时间、归档前置校验、写归档时间。
 *
 * <p>{@code REQUIRE_ACCEPTANCE_PASSED} 是<b>C9 允许的三处业务前置校验之一</b>（另外两处是排课
 * 三项校验与案例上架），也是全项目仅有的三处。规则 C2 禁止为状态变更添加业务前置条件，这一条
 * 是需求 5.2.5 显式开的口子：未验收通过的需求点归档要被拒绝并提示「该需求尚未业务验收通过」
 * （验收点 A1-8）。<b>不要照着它给别的转换加前置校验。</b>
 *
 * <p>校验放在副作用而不是 Controller，是为了让统一转换接口
 * （{@code POST /api/demands/{id}/transitions}）也拦得住——归档没有专用接口，前端走的就是那一条。
 * 副作用抛异常时整笔事务回滚，状态列与流转日志一起退回，符合 C3 的硬阻断要求。
 */
@Component
public class DemandDeliveryEffectHandler implements EffectHandler {

    private final DemandService demands;
    private final DemandAcceptanceService acceptances;
    private final StateMachineRegistry registry;

    public DemandDeliveryEffectHandler(DemandService demands, DemandAcceptanceService acceptances,
                                       StateMachineRegistry registry) {
        this.demands = demands;
        this.acceptances = acceptances;
        this.registry = registry;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.SET_DELIVERED_AT.equals(effectCode)
                || Effect.SET_ARCHIVED_AT.equals(effectCode)
                || Effect.REQUIRE_ACCEPTANCE_PASSED.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (Effect.SET_DELIVERED_AT.equals(effectCode)) {
            acceptances.markDelivered(context.objectId());
            return;
        }
        if (Effect.SET_ARCHIVED_AT.equals(effectCode)) {
            acceptances.markArchived(context.objectId());
            return;
        }
        requireAcceptancePassed(context);
    }

    /**
     * 提示文案是需求 5.2.5 落地要点第 3 条规定的原话「该需求尚未业务验收通过」，其中的状态名
     * 由转换表拼进来而不是抄进字面量——状态改名时文案要跟着变，这也是 E2-6 门禁的要求。
     */
    private void requireAcceptancePassed(EffectContext context) {
        String current = demands.require(context.objectId()).getAcceptanceState();
        if (!Objects.equals(current, passedState())) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "该需求尚未业务%s".formatted(passedState()));
        }
    }

    /**
     * 「验收通过」这个状态值从转换表里反查——它是「录入验收结论=通过」那条转换的目标状态。
     *
     * <p>写成字面量就出现了状态定义的第二个来源，A-6 的状态硬编码门禁也会拦下。
     */
    private String passedState() {
        return registry.requireMachine(DemandStateMachines.OBJECT_TYPE,
                        DemandStateMachines.FIELD_ACCEPTANCE_STATE).transitions().stream()
                .filter(t -> DemandStateMachines.ACTION_RECORD_ACCEPTANCE_PASS.equals(t.action()))
                .map(Transition::to)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "业务验收状态机里找不到动作 " + DemandStateMachines.ACTION_RECORD_ACCEPTANCE_PASS));
    }
}
