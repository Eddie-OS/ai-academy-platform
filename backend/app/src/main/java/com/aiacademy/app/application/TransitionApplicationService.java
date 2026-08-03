package com.aiacademy.app.application;

import com.aiacademy.app.application.effect.EffectContext;
import com.aiacademy.app.application.effect.EffectDispatcher;
import com.aiacademy.app.repository.StateSnapshotMapper;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.StateObjectMapping;
import com.aiacademy.platform.statemachine.domain.StateObjectMappings;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import com.aiacademy.platform.statemachine.service.StateTransitionService;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 状态转换的应用服务：<b>执行转换 + 在同一事务内执行副作用</b>（规则 AR-4、开发 5.1.5）。
 *
 * <p>放在 app 层的原因是副作用要跨模块：置子状态回到状态机引擎，快照材料版本与创建评审记录落在
 * 业务模块，派生任务落在聚合模块。平台模块不得依赖业务模块（AR-2），所以编排点只能在这里。
 *
 * <p><b>业务侧的复合操作不应绕过本类。</b>课程「提交评审」这种一次点击引发多张表变更的操作，
 * 走的是业务 Controller，但其中的状态变更部分仍要经由本类——否则副作用会漏执行，
 * 而漏执行不报错（见 {@link EffectDispatcher} 的说明）。
 */
@Service
public class TransitionApplicationService {

    private final StateTransitionService transitions;
    private final StateMachineRegistry registry;
    private final EffectDispatcher effects;
    private final StateSnapshotMapper snapshots;

    public TransitionApplicationService(StateTransitionService transitions,
                                        StateMachineRegistry registry,
                                        EffectDispatcher effects,
                                        StateSnapshotMapper snapshots) {
        this.transitions = transitions;
        this.registry = registry;
        this.effects = effects;
        this.snapshots = snapshots;
    }

    /**
     * 执行一次转换并派发副作用。
     *
     * @return 命中的转换定义，调用方可据此知道目标状态与副作用清单
     */
    @Transactional
    public Transition transit(TransitCommand command) {
        Transition transition = transitions.transit(command);
        effects.dispatch(new EffectContext(
                command.objectType(), command.objectId(), transition, command.remark()));
        return transition;
    }

    /**
     * 一个对象全部状态字段的当前值与可执行动作。
     *
     * <p>按状态字段分组返回：课程有 5 个状态字段（主状态 + 4 组子状态），前端的
     * {@code ActionGuard} 一次吃一组，混在一起会让「开始开发」这类主子同名的动作无法区分。
     */
    /**
     * 新建对象后补记初始转换，并派发它的副作用（如「课程立项」要派生一条课程开发任务）。
     *
     * <p>由各业务模块的创建流程在<b>同一事务内</b>调用。不做成领域事件监听，是因为副作用里有
     * 结构性写操作，事件监听的失败不该被吞掉，而调用方需要它整体回滚。
     */
    @Transactional
    public Transition initialize(String objectType, long objectId, String stateField, String action) {
        Transition transition = transitions.initialize(objectType, objectId, stateField, action);
        effects.dispatch(new EffectContext(objectType, objectId, transition, null));
        return transition;
    }

    @Transactional(readOnly = true)
    public ObjectStateView available(String objectType, long objectId) {
        StateObjectMapping mapping = StateObjectMappings.require(objectType);
        if (!snapshots.existsById(mapping.table(), objectId)) {
            throw new NotFoundException("对象不存在或已删除：%s#%d".formatted(objectType, objectId));
        }

        List<FieldAvailability> fields = new ArrayList<>();
        for (Map.Entry<String, String> entry : mapping.stateColumns().entrySet()) {
            String stateField = entry.getKey();
            String currentState = snapshots.selectState(mapping.table(), entry.getValue(), objectId);
            fields.add(describe(objectType, stateField, currentState));
        }

        Integer version = mapping.optimisticLocked()
                ? snapshots.selectVersion(mapping.table(), objectId)
                : null;
        return new ObjectStateView(objectType, objectId, version, fields);
    }

    private FieldAvailability describe(String objectType, String stateField, String currentState) {
        StateMachineDef machine = registry.requireMachine(objectType, stateField);
        List<Transition> allowed = registry.availableTransitions(objectType, stateField, currentState);

        Set<String> allowedLabels = new LinkedHashSet<>();
        List<ActionOption> options = new ArrayList<>();
        for (Transition t : allowed) {
            allowedLabels.add(t.actionLabel());
            options.add(new ActionOption(t.action(), t.actionLabel(), t.to()));
        }

        // 该状态机里存在、但当前状态下走不了的动作，带上原因置灰。体验总纲 C-1：
        // 界面必须能解释为什么不能操作，「你不能这么做」没有用
        List<BlockedAction> blocked = machine.transitions().stream()
                .map(Transition::actionLabel)
                .distinct()
                .filter(label -> !allowedLabels.contains(label))
                .map(label -> new BlockedAction(label, blockedReason(currentState, label)))
                .toList();

        boolean terminal = currentState != null && machine.terminalStates().contains(currentState);
        return new FieldAvailability(stateField, machine.machineName(), currentState, terminal,
                List.copyOf(allowedLabels), blocked, options);
    }

    private static String blockedReason(String currentState, String actionLabel) {
        return "当前状态为「%s」，不允许执行「%s」"
                .formatted(currentState == null ? "（空）" : currentState, actionLabel);
    }

    /**
     * @param version 乐观锁版本号；只有需求、课程、案例三张表有（规则 K1），其余为 null
     */
    public record ObjectStateView(String objectType, long objectId, Integer version,
                                  List<FieldAvailability> fields) {
    }

    /**
     * @param allowedActions 当前可执行动作的<b>中文动作名</b>，直接喂给前端 ActionGuard
     * @param actions 中文动作名与英文动作码的对照，前端点击后用它拼 POST 请求体
     */
    public record FieldAvailability(String stateField, String machineName, String currentState,
                                    boolean terminal, List<String> allowedActions,
                                    List<BlockedAction> blockedActions, List<ActionOption> actions) {
    }

    public record BlockedAction(String action, String reason) {
    }

    public record ActionOption(String action, String label, String toState) {
    }
}
