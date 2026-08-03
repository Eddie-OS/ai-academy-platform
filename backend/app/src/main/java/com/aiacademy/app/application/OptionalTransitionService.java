package com.aiacademy.app.application;

import com.aiacademy.app.repository.StateSnapshotMapper;
import com.aiacademy.platform.statemachine.domain.StateObjectMapping;
import com.aiacademy.platform.statemachine.domain.StateObjectMappings;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * 「能走就走」的子状态推进：当前状态下有这个动作就执行，没有就跳过并记一条日志。
 *
 * <p><b>只用于子状态，不用于主状态。</b>主状态走不通必须报错（规则 C3 硬阻断）；子状态走不通
 * 只能跳过——需求 5.3.2 明确四组子状态各自独立、不做组合校验，而运营完全可能没点过「开始试讲」
 * 就直接录了试讲结论，此时试讲子状态停在「待试讲」，到「待发布」没有通路。为了一个展示用的
 * 子状态把录结论整个拒掉，会直接拦住历史数据录入（规则 C2）。
 *
 * <p>与 {@code SubStateEffectHandler} 的区别是查找方式：那边由副作用码指定<b>目标状态</b>，
 * 这边由业务动作指定<b>动作码</b>（需求 5.4.3 的「录入试讲课程结论=合格」在主状态与试讲子状态
 * 上是同一个动作码，两个状态机各走各的）。
 */
@Service
public class OptionalTransitionService {

    private static final Logger log = LoggerFactory.getLogger(OptionalTransitionService.class);

    private final StateMachineRegistry registry;
    private final TransitionApplicationService transitions;
    private final StateSnapshotMapper snapshots;

    public OptionalTransitionService(StateMachineRegistry registry,
                                     TransitionApplicationService transitions,
                                     StateSnapshotMapper snapshots) {
        this.registry = registry;
        this.transitions = transitions;
        this.snapshots = snapshots;
    }

    /** @return 是否真的走了一次转换 */
    @Transactional
    public boolean tryTransit(String objectType, long objectId, String stateField,
                              String action, String remark) {
        StateObjectMapping mapping = StateObjectMappings.require(objectType);
        String currentState = snapshots.selectState(mapping.table(), mapping.columnOf(stateField), objectId);

        Optional<Transition> transition = registry.find(objectType, stateField, currentState, action);
        if (transition.isEmpty()) {
            log.info("「{}」当前是「{}」，没有动作 {} 的通路，本次跳过。对象 {}#{}",
                    stateField, currentState, action, objectType, objectId);
            return false;
        }
        transitions.transit(new TransitCommand(objectType, objectId, stateField, action, null, remark));
        return true;
    }
}
