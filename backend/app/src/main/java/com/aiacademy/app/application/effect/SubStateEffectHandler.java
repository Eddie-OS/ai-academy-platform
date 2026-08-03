package com.aiacademy.app.application.effect;

import com.aiacademy.app.repository.StateSnapshotMapper;
import com.aiacademy.platform.statemachine.domain.StateObjectMapping;
import com.aiacademy.platform.statemachine.domain.StateObjectMappings;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import com.aiacademy.platform.statemachine.service.StateTransitionService;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 副作用 {@code SET_SUB_STATE:课程开发状态=待开发}：随主状态置子状态（需求 5.3.1、5.4.x）。
 *
 * <p><b>置位仍然走状态机引擎，不直接改列。</b>子状态也是状态，也要写流转日志、也要更新
 * {@code last_state_changed_at}。绕过引擎直接 UPDATE 会让课程的子状态变更在流转日志里消失，
 * 而 15.2 的效率指标里有按子状态取时点的口径。
 *
 * <p><b>用哪条转换：从子状态的当前值出发，找目标状态等于副作用指定值的那一条。</b>
 * 不能一律按「（空）→ 目标」找：主状态「开发 → 自检」要把开发子状态置成「自检中」，而
 * 需求 5.4.1 里「自检中」只能从「开发中」到达，起点为空的那条转换指向的是「待开发」。
 *
 * <p><b>找不到路径时只记日志，不阻断主状态转换。</b>运营可能没点过子状态的「开始开发」就直接
 * 把主状态推到「自检」，此时子状态停在「待开发」，到「自检中」没有通路。需求 5.3.2 明确
 * 「四组子状态各自独立，不做组合校验」，规则 C2 也不允许为状态变更加业务前置条件——
 * 为了一个展示用的子状态把主状态变更整个拒掉，会直接拦住历史数据录入。
 */
@Component
public class SubStateEffectHandler implements EffectHandler {

    private static final Logger log = LoggerFactory.getLogger(SubStateEffectHandler.class);

    private static final String PREFIX = "SET_SUB_STATE:";

    private final StateMachineRegistry registry;
    private final StateTransitionService transitions;
    private final StateSnapshotMapper snapshots;

    public SubStateEffectHandler(StateMachineRegistry registry,
                                 StateTransitionService transitions,
                                 StateSnapshotMapper snapshots) {
        this.registry = registry;
        this.transitions = transitions;
        this.snapshots = snapshots;
    }

    @Override
    public boolean supports(String effectCode) {
        return effectCode.startsWith(PREFIX);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        String body = effectCode.substring(PREFIX.length());
        int split = body.indexOf('=');
        if (split < 0) {
            throw new IllegalStateException(
                    "副作用码格式应为 SET_SUB_STATE:状态字段=目标状态，实际是 " + effectCode);
        }
        String stateField = body.substring(0, split);
        String targetState = body.substring(split + 1);

        String currentState = currentStateOf(context.objectType(), stateField, context.objectId());
        if (targetState.equals(currentState)) {
            // 课程走「试讲 → 优化 → 评审决策 → 试讲」这类回路时必然出现：上一轮试讲不合格已把
            // 试讲状态置回「待试讲」。副作用要的是结果而不是过程，已达成即视为完成
            return;
        }

        Optional<Transition> transition = registry.requireMachine(context.objectType(), stateField)
                .transitions().stream()
                .filter(t -> java.util.Objects.equals(t.from(), currentState))
                .filter(t -> targetState.equals(t.to()))
                .findFirst();

        if (transition.isEmpty()) {
            log.warn("「{}」当前是「{}」，到「{}」没有转换，本次随主状态置位跳过。触发对象 {}#{}，动作「{}」",
                    stateField, currentState, targetState, context.objectType(), context.objectId(),
                    context.transition().actionLabel());
            return;
        }

        // 不传版本号：主状态那次转换已经把 version 自增过了，这里再带旧值必然冲突。
        // 并发安全由主状态转换持有的 FOR UPDATE 行锁兜住——两次写的是同一行
        transitions.transit(new TransitCommand(context.objectType(), context.objectId(),
                stateField, transition.get().action(), null, context.remark()));
    }

    private String currentStateOf(String objectType, String stateField, long objectId) {
        StateObjectMapping mapping = StateObjectMappings.require(objectType);
        return snapshots.selectState(mapping.table(), mapping.columnOf(stateField), objectId);
    }
}
