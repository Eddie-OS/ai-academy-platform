package com.aiacademy.platform.statemachine.domain;

import java.util.List;
import java.util.Set;

/**
 * {@link StateMachineDef} 的通用实现。16 张转换表都是纯数据，不需要各自一个类。
 *
 * <p>终态集合显式声明，不从转换表推导——理由见 {@link StateMachineDef#terminalStates()}。
 * 一致性由测试保证：声明的终态必须确实没有出向转换。
 */
public record SimpleStateMachineDef(
        String machineName,
        String objectType,
        String stateField,
        Set<String> terminalStates,
        List<Transition> transitions) implements StateMachineDef {

    public SimpleStateMachineDef {
        terminalStates = Set.copyOf(terminalStates);
        transitions = List.copyOf(transitions);
    }

    /** 没有终态的状态机（子状态机、以及可从"完成"退回的对象）用这个构造。 */
    public SimpleStateMachineDef(
            String machineName, String objectType, String stateField, List<Transition> transitions) {
        this(machineName, objectType, stateField, Set.of(), transitions);
    }

    /** record 默认的 toString 会把全部转换展开成上千字符，参数化测试的用例名靠它，必须简短。 */
    @Override
    public String toString() {
        return "%s（%s.%s，%d 条转换）".formatted(machineName, objectType, stateField, transitions.size());
    }
}
