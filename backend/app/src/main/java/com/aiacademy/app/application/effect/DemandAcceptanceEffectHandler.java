package com.aiacademy.app.application.effect;

import com.aiacademy.business.demand.domain.Demand;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.service.DemandAcceptanceService;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import com.aiacademy.platform.statemachine.service.StateTransitionService;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Optional;

/**
 * 业务验收的三个副作用（需求 5.2.5 第 2～4 行）：复核验收字段、按出口退回、验收轮次 +1。
 *
 * <p>{@code RECORD_ACCEPTANCE} 是<b>复核</b>而不是补写，理由同 {@code DemandOutletEffectHandler}：
 * 验收人、验收时间与结论随状态一起落库（见 {@code DemandApplicationService.recordAcceptanceConclusion}），
 * 这里读回来确认它真的在。有人日后绕过验收结论接口、直接调统一转换接口把需求推到「验收通过」时，
 * 这里当场拒绝——否则会出现一条「验收通过但没有验收人」的需求，而它已经可以归档了。
 *
 * <p><b>{@code REVERT_BY_OUTLET} 只对出口一有效，出口二暂不退回。</b>需求 5.2.5 第 3 行要求
 * 「出口一退到解决方案状态=已输出，出口二退到需求开发状态=开发中」，但 5.2.4 的需求开发状态
 * 转换表里<b>没有任何一条从「已上线」出发到「开发中」的转换</b>（只有「已上线 → 优化中」）。
 * 两处文档在这里对不上，已记入 {@code docs/文档待修清单.md} 的 D-13 待业务裁决。在裁决之前
 * 不自行选一条替代路径：把它退到「优化中」是另一个业务含义（那是上线后的迭代，不是验收返工），
 * 而状态一旦写错，15.2 的效率指标与流转日志都无法事后区分。出口二的需求验收不通过后停在
 * 「已上线」，运营可自行按转换表推进。
 */
@Component
public class DemandAcceptanceEffectHandler implements EffectHandler {

    private static final Logger log = LoggerFactory.getLogger(DemandAcceptanceEffectHandler.class);

    private final DemandService demands;
    private final DemandAcceptanceService acceptances;
    private final StateMachineRegistry registry;
    private final StateTransitionService transitions;

    public DemandAcceptanceEffectHandler(DemandService demands, DemandAcceptanceService acceptances,
                                         StateMachineRegistry registry,
                                         StateTransitionService transitions) {
        this.demands = demands;
        this.acceptances = acceptances;
        this.registry = registry;
        this.transitions = transitions;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.RECORD_ACCEPTANCE.equals(effectCode)
                || Effect.REVERT_BY_OUTLET.equals(effectCode)
                || Effect.INCREMENT_ACCEPTANCE_ROUND.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (Effect.RECORD_ACCEPTANCE.equals(effectCode)) {
            requireConclusionRecorded(context);
            return;
        }
        if (Effect.INCREMENT_ACCEPTANCE_ROUND.equals(effectCode)) {
            acceptances.incrementRound(context.objectId());
            return;
        }
        revertByOutlet(context);
    }

    private void requireConclusionRecorded(EffectContext context) {
        Demand demand = demands.require(context.objectId());
        if (demand.getAcceptorName() == null || demand.getAcceptedAt() == null) {
            throw new IllegalStateException(("需求 %d 推进到验收结论时没有验收人或验收时间。"
                    + "验收结论必须走 POST /api/demands/{id}/acceptance-conclusion 录入，"
                    + "它会在同一事务里写字段再转状态").formatted(context.objectId()));
        }
    }

    /**
     * 验收不通过时按出口退回上一环节。
     *
     * <p>找不到通路时<b>只记日志、不阻断</b>：运营完全可能在解决方案还没发布时就录了一条验收
     * 不通过（规则 C2 不允许为状态变更加业务前置条件，历史数据补录尤其如此）。为了一次退回把
     * 验收结论整个拒掉，等于逼运营去改数据迁就系统。
     */
    private void revertByOutlet(EffectContext context) {
        Demand demand = demands.require(context.objectId());
        String outlet = demand.getOutlet();

        if (!DemandEnums.OUTLET_SOLUTION.equals(outlet)) {
            log.warn("需求 {} 的分流出口是「{}」，本次不自动退回：5.2.4 的转换表里没有到退回目标的通路（D-13）",
                    context.objectId(), outlet);
            return;
        }

        String currentState = demand.getSolutionState();
        Optional<Transition> revert = registry.requireMachine(DemandStateMachines.OBJECT_TYPE,
                        DemandStateMachines.FIELD_SOLUTION_STATE).transitions().stream()
                .filter(t -> Objects.equals(t.from(), currentState))
                .filter(t -> DemandStateMachines.ACTION_RETURN_FOR_REVISION.equals(t.action()))
                .findFirst();

        if (revert.isEmpty()) {
            log.warn("需求 {} 的解决方案状态是「{}」，到「退回修改」没有转换，本次按出口退回跳过",
                    context.objectId(), currentState);
            return;
        }

        // 不传版本号：验收状态那次转换已经把 version 自增过了，带旧值必然冲突。并发安全由那次
        // 转换持有的 FOR UPDATE 行锁兜住——两次写的是同一行
        transitions.transit(new TransitCommand(context.objectType(), context.objectId(),
                DemandStateMachines.FIELD_SOLUTION_STATE, revert.get().action(),
                null, "业务验收结论为" + DemandEnums.ACCEPTANCE_REJECT + "，按分流出口退回"));
    }
}
