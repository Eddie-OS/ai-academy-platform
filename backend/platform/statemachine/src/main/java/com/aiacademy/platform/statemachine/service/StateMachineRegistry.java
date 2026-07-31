package com.aiacademy.platform.statemachine.service;

import com.aiacademy.common.exception.IllegalTransitionException;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.StateMachineCatalog;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 转换表注册表。<b>启动时把 16 张表加载为不可变索引，运行时只做查表</b>
 * （《开发实施文档》5.1.3：编译期静态表）。
 *
 * <p>一期状态机硬编码，不做流程配置能力（需求 16.2 第 10 项），所以这里没有任何动态加载或刷新。
 *
 * <p>本类<b>不做权限判定</b>。需求 5.1 规则 C8 已确定全部状态变更的执行者都是运营账号，
 * 判权收敛在 PermissionInterceptor 一处（AR-7）。《开发实施文档》5.1.4 转换执行流程的第 4 步
 * {@code permission.assertCan(...)} 是 V1.0 遗留，V1.1 简化权限模型后不再需要。
 */
@Component
public class StateMachineRegistry {

    private final Map<MachineKey, StateMachineDef> machines;
    private final Map<TransitionKey, Transition> transitions;

    public StateMachineRegistry() {
        Map<MachineKey, StateMachineDef> machineIndex = new LinkedHashMap<>();
        Map<TransitionKey, Transition> transitionIndex = new LinkedHashMap<>();

        for (StateMachineDef def : StateMachineCatalog.all()) {
            MachineKey machineKey = new MachineKey(def.objectType(), def.stateField());
            StateMachineDef duplicate = machineIndex.put(machineKey, def);
            if (duplicate != null) {
                throw new IllegalStateException("状态机重复注册：" + machineKey
                        + "，冲突于「" + duplicate.machineName() + "」与「" + def.machineName() + "」");
            }
            for (Transition t : def.transitions()) {
                TransitionKey key = new TransitionKey(
                        def.objectType(), def.stateField(), t.from(), t.action());
                Transition conflict = transitionIndex.put(key, t);
                // 同一（对象类型 + 状态字段 + 当前状态 + 动作）出现两个不同目标状态意味着转录错误：
                // 需求表格里这样的组合是唯一的。默默覆盖会让其中一条转换永远不生效。
                if (conflict != null && !conflict.to().equals(t.to())) {
                    throw new IllegalStateException("「%s」的转换冲突：%s + %s 同时指向 %s 与 %s"
                            .formatted(def.machineName(), t.from(), t.actionLabel(),
                                    conflict.to(), t.to()));
                }
            }
        }
        this.machines = Map.copyOf(machineIndex);
        this.transitions = Map.copyOf(transitionIndex);
    }

    /** 查表。返回空即非法（规则 C3：转换表中未列出的组合即为非法）。 */
    public Optional<Transition> find(String objectType, String stateField, String currentState, String action) {
        return Optional.ofNullable(
                transitions.get(new TransitionKey(objectType, stateField, currentState, action)));
    }

    /**
     * 查表，不存在即抛 {@link IllegalTransitionException}。
     *
     * <p>规则 C3 要求硬阻断，因此调用方<b>不应</b>先用 {@link #find} 判断再决定要不要拒绝——
     * 那样很容易在某条路径上漏掉拒绝。执行转换时一律走本方法。
     */
    public Transition require(String objectType, String stateField, String currentState, String action) {
        return find(objectType, stateField, currentState, action)
                .orElseThrow(() -> new IllegalTransitionException(
                        currentState, actionLabelOf(objectType, stateField, action)));
    }

    /**
     * 当前状态下可执行的转换，供 {@code GET /api/{objectType}/{id}/transitions/available}
     * 装配 allowedActions（《开发实施文档》7.4）。
     */
    public List<Transition> availableTransitions(String objectType, String stateField, String currentState) {
        return requireMachine(objectType, stateField).transitions().stream()
                .filter(t -> java.util.Objects.equals(t.from(), currentState))
                .toList();
    }

    public StateMachineDef requireMachine(String objectType, String stateField) {
        StateMachineDef def = machines.get(new MachineKey(objectType, stateField));
        if (def == null) {
            throw new IllegalStateException(
                    "未注册的状态机：objectType=" + objectType + ", stateField=" + stateField);
        }
        return def;
    }

    public List<StateMachineDef> allMachines() {
        return List.copyOf(machines.values());
    }

    /**
     * 动作码对应的中文动作名，用于拼装拒绝文案。
     *
     * <p>转换不存在时拿不到 {@link Transition}，因此从同一状态机的其他转换里找同名动作码。
     * 找不到说明前端传了一个该状态机根本没有的动作码，直接回显原始码值——
     * 这种情况下文案不如给个可辨认的技术值，便于排查。
     */
    private String actionLabelOf(String objectType, String stateField, String action) {
        return requireMachine(objectType, stateField).transitions().stream()
                .filter(t -> t.action().equals(action))
                .map(Transition::actionLabel)
                .findFirst()
                .orElse(action);
    }

    private record MachineKey(String objectType, String stateField) {
        @Override
        public String toString() {
            return objectType + "." + stateField;
        }
    }

    private record TransitionKey(String objectType, String stateField, String from, String action) {
    }
}
