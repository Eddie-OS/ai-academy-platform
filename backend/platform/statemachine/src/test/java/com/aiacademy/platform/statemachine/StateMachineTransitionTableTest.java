package com.aiacademy.platform.statemachine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.IllegalTransitionException;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.StateMachineCatalog;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * 阶段 1 出口准则 <b>E1-1</b>：需求文档第 5 章的全部转换行有对应通过的参数化测试；
 * 非法转换全部返回 {@code ILLEGAL_TRANSITION}。
 *
 * <p>验证链条是三段独立的：<br>
 * 需求文档第 5 章 markdown → 解析脚本 → CSV → <b>本测试</b> → 手写转换表 → 引擎。<br>
 * 引擎不读 CSV，测试不读引擎的表定义源码，两边任何一处转录出错都会红灯。
 *
 * <p><b>为什么必须这样绕一圈：</b>AI 一次生成 16 张转换表，错漏可能是系统性的
 * （把某一列理解成另一个含义，于是同一列全错）。参数化测试是唯一能发现系统性错误的手段，
 * 而它的输入恰好就是需求文档的表格本身（《开发实施文档》8.5）。
 */
class StateMachineTransitionTableTest {

    private static final StateMachineRegistry REGISTRY = new StateMachineRegistry();

    /**
     * 需求 5.2.5「前置与终态」表的列头是「前置 / 动作 / 结果 / 执行人」，没有「当前状态 / 目标状态」，
     * 机械解析会解出错误结构，因此这张表手工转录、不进 CSV。
     * 涉及它的双向比对必须排除，<b>人工验收时这一张要单独对着需求 5.2.5 看</b>。
     */
    private static final String MANUALLY_TRANSCRIBED = "需求交付标记";

    static Stream<RequirementTransitionCsv> requirementTransitions() {
        return RequirementTransitionCsv.loadAll().stream();
    }

    // ------------------------------------------------------------------
    // E1-1 正向：需求文档的每一行都能在引擎里查到，且目标状态一致
    // ------------------------------------------------------------------

    @ParameterizedTest(name = "{0}")
    @MethodSource("requirementTransitions")
    @DisplayName("需求第 5 章的每一条转换都能被引擎执行且目标状态一致")
    void 需求转换逐行驱动引擎(RequirementTransitionCsv row) {
        StateMachineDef machine = REGISTRY.requireMachine(row.objectType(), row.stateField());

        // 用中文动作名而不是英文动作码做连接键：动作码是实现侧自拟的，
        // 中文动作名逐字来自需求表格，用它才能真正校验「这条转换对应需求哪一行」。
        List<Transition> matched = machine.transitions().stream()
                .filter(t -> Objects.equals(t.from(), row.fromOrNull()))
                .filter(t -> t.actionLabel().equals(row.actionLabel()))
                .toList();

        assertThat(matched)
                .as("引擎的「%s」缺少这条转换，或中文动作名与需求表格不一致", row.machine())
                .hasSize(1);
        assertThat(matched.get(0).to())
                .as("目标状态与需求文档不一致")
                .isEqualTo(row.to());

        // 再走一遍注册表的查表入口，确认索引建对了（上面查的是定义，这里查的是运行时索引）
        assertThat(REGISTRY.find(row.objectType(), row.stateField(),
                        row.fromOrNull(), matched.get(0).action()))
                .as("注册表索引里查不到这条转换")
                .contains(matched.get(0));
    }

    // ------------------------------------------------------------------
    // E1-1 反向：引擎里不得有需求文档之外的转换
    // ------------------------------------------------------------------

    @Test
    @DisplayName("引擎里的每条转换都能在需求第 5 章找到（不得自行增补）")
    void 引擎不得增补需求之外的转换() {
        Set<String> fromRequirement = RequirementTransitionCsv.loadAll().stream()
                .map(r -> key(r.objectType(), r.stateField(), r.fromOrNull(), r.actionLabel(), r.to()))
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        List<String> extra = new ArrayList<>();
        for (StateMachineDef machine : REGISTRY.allMachines()) {
            if (machine.machineName().equals(MANUALLY_TRANSCRIBED)) {
                continue;
            }
            for (Transition t : machine.transitions()) {
                String k = key(machine.objectType(), machine.stateField(), t.from(), t.actionLabel(), t.to());
                if (!fromRequirement.contains(k)) {
                    extra.add(machine.machineName() + "：" + k);
                }
            }
        }
        assertThat(extra)
                .as("这些转换在需求第 5 章里找不到。硬约束：不要自行增补任何转换")
                .isEmpty();
    }

    private static String key(String objectType, String stateField, String from, String actionLabel, String to) {
        return "%s.%s[%s + %s → %s]".formatted(objectType, stateField, from, actionLabel, to);
    }

    // ------------------------------------------------------------------
    // E1-1 非法转换：穷举所有未列出的（状态 × 动作）组合
    // ------------------------------------------------------------------

    static Stream<StateMachineDef> allMachines() {
        return REGISTRY.allMachines().stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("allMachines")
    @DisplayName("转换表中未列出的组合一律拒绝并返回 ILLEGAL_TRANSITION")
    void 非法组合全部硬阻断(StateMachineDef machine) {
        Set<String> states = new LinkedHashSet<>();
        states.add(null); // 对象新建或状态字段未置值
        machine.transitions().forEach(t -> {
            states.add(t.from());
            states.add(t.to());
        });
        Set<String> actions = machine.transitions().stream()
                .map(Transition::action)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        int rejected = 0;
        for (String state : states) {
            for (String action : actions) {
                if (REGISTRY.find(machine.objectType(), machine.stateField(), state, action).isPresent()) {
                    continue;
                }
                IllegalTransitionException thrown = null;
                try {
                    REGISTRY.require(machine.objectType(), machine.stateField(), state, action);
                } catch (IllegalTransitionException e) {
                    thrown = e;
                }
                assertThat(thrown)
                        .as("「%s」的 %s + %s 未在转换表中，必须硬阻断（规则 C3）",
                                machine.machineName(), state, action)
                        .isNotNull();
                assertThat(thrown.errorCode()).isEqualTo(ErrorCode.ILLEGAL_TRANSITION);
                // 文案必须能解释为什么不能操作（体验总纲 C-1），不能是英文技术描述
                assertThat(thrown.getMessage()).contains("不能执行");
                rejected++;
            }
        }
        assertThat(rejected)
                .as("「%s」没有任何非法组合可测，说明状态或动作取值没被穷举到", machine.machineName())
                .isPositive();
    }

    @Test
    @DisplayName("动作码不存在于该状态机时也必须拒绝")
    void 未知动作码同样硬阻断() {
        assertThatThrownBy(() -> REGISTRY.require("COURSE", "课程主状态", "立项", "NO_SUCH_ACTION"))
                .isInstanceOf(IllegalTransitionException.class)
                .hasMessageContaining("立项");
    }

    // ------------------------------------------------------------------
    // 清单核对：需求 5.13「开发按本清单核对，不多不少」
    // ------------------------------------------------------------------

    @Test
    @DisplayName("装载 15 个业务状态机 + 任务状态机，共 16 张转换表")
    void 状态机数量与需求清单一致() {
        assertThat(StateMachineCatalog.businessMachines())
                .as("需求 5.13 清单为 15 个业务状态机")
                .hasSize(StateMachineCatalog.BUSINESS_MACHINE_COUNT);
        assertThat(REGISTRY.allMachines())
                .as("引擎实际装载 16 张表：15 个业务状态机 + 任务（任务不计入 15 之内）")
                .hasSize(StateMachineCatalog.BUSINESS_MACHINE_COUNT + 1);
    }

    @Test
    @DisplayName("讲师培养状态不是状态机，不得出现在注册表里")
    void 讲师培养状态不得建成状态机() {
        // C10：它是可自由选择的枚举字段。做成状态机会在「改错了想改回去」时拦住运营，
        // 而这个限制从未被需求要求过。判断依据：需求第 5 章里没有它的转换表。
        assertThat(REGISTRY.allMachines())
                .extracting(StateMachineDef::stateField)
                .doesNotContain("培养状态", "讲师培养状态");
    }

    // ------------------------------------------------------------------
    // 终态与退出预警范围：两个概念不能合并
    // ------------------------------------------------------------------

    @Test
    @DisplayName("需求 13.1.2 自动关闭规则点名的四个终态都已声明")
    void 终态覆盖自动关闭规则() {
        Set<String> declared = REGISTRY.allMachines().stream()
                .flatMap(m -> m.terminalStates().stream())
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        assertThat(declared)
                .as("13.1.2：业务对象转入终态（已归档 / 已关闭 / 课程归档 / 案例归档）时其下未完成任务自动关闭")
                .contains("已归档", "已关闭", "课程归档", "案例归档");

        assertThat(REGISTRY.requireMachine("COURSE", "课程主状态").terminalStates())
                .as("「精品案例」不是终态，它还要走到案例归档")
                .containsExactlyInAnyOrder("已关闭", "课程归档", "案例归档");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("allMachines")
    @DisplayName("声明的终态确实没有出向转换")
    void 终态不得有出向转换(StateMachineDef machine) {
        Set<String> statesWithOutgoing = machine.transitions().stream()
                .map(Transition::from)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        // 不用 doesNotContainAnyElementsOf：出向状态集合可能为空（课程发布子状态只有一条从 null 出发的
        // 转换），而它对空入参会直接抛 IllegalArgumentException。
        assertThat(machine.terminalStates().stream().filter(statesWithOutgoing::contains).toList())
                .as("这些状态被声明为终态，但转换表里还有它们的出向转换")
                .isEmpty();
        assertThat(machine.transitions().stream().map(Transition::to).toList())
                .as("声明的终态必须是转换表里真实存在的目标状态")
                .containsAll(machine.terminalStates());
    }

    @Test
    @DisplayName("课程的 4 组子状态都没有终态")
    void 子状态机不得有终态() {
        // 曾经踩过的坑：用「没有出向转换」推导终态，会把「试讲状态=待发布」「课程发布状态=已发布」
        // 「课程自检状态=（空）」算成终态。课程的生命周期只由主状态决定；按推导结果关闭任务，
        // 课程一进入「发布」就会把它下面的任务全关掉。
        for (String subState : List.of("课程开发状态", "课程自检状态", "试讲状态", "课程发布状态")) {
            assertThat(REGISTRY.requireMachine("COURSE", subState).terminalStates())
                    .as("「%s」是子状态机，课程的生命周期由主状态决定", subState)
                    .isEmpty();
        }
    }

    @Test
    @DisplayName("退出预警范围不等于终态：培训计划「已完成」退出预警但可退回")
    void 退出预警范围与终态是两个概念() {
        StateMachineDef plan = REGISTRY.requireMachine("TRAINING_PLAN", "培训计划状态");

        assertThat(plan.transitions())
                .filteredOn(Transition::exitsWarningScope)
                .extracting(Transition::to)
                .containsExactly("已完成");
        assertThat(plan.terminalStates())
                .as("「已完成」有一条「退回执行中」，若把它当终态，退回后其下任务会被误关闭")
                .isEmpty();

        assertThat(REGISTRY.requireMachine("CASE", "案例状态").terminalStates())
                .as("「已上架」有一条「下架修改」，不是终态")
                .isEmpty();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("requirementTransitions")
    @DisplayName("需求表格标注「退出预警范围」的转换在引擎里被标记")
    void 退出预警范围标注与需求一致(RequirementTransitionCsv row) {
        Transition t = transitionOf(row);
        assertThat(t.exitsWarningScope())
                .as("需求副作用列为「%s」", row.effects())
                .isEqualTo(row.effects().contains("退出预警范围"));
    }

    // ------------------------------------------------------------------
    // 副作用：只校验最容易做错、且能机械校验的两类
    // ------------------------------------------------------------------

    @ParameterizedTest(name = "{0}")
    @MethodSource("requirementTransitions")
    @DisplayName("需求要求派生任务的转换都带上了对应任务类型的 DERIVE_TASK 副作用")
    void 任务派生副作用与需求一致(RequirementTransitionCsv row) {
        Transition t = transitionOf(row);
        List<String> derived = t.effects().stream().filter(e -> e.startsWith("DERIVE_TASK:")).toList();

        if (!row.effects().contains("派生")) {
            assertThat(derived).as("需求没要求派生任务，引擎不应自行派生").isEmpty();
            return;
        }
        assertThat(derived).as("需求副作用列为「%s」，引擎缺少任务派生", row.effects()).isNotEmpty();
        // 任务类型名也要对得上：派生了任务但派生错类型，只看「有没有」是查不出来的
        for (String effect : derived) {
            String taskType = effect.substring("DERIVE_TASK:".length());
            assertThat(row.effects())
                    .as("引擎派生「%s」任务，但需求副作用列没提到它", taskType)
                    .contains(taskType);
        }
    }

    @Test
    @DisplayName("全部副作用码都是 Effect 中声明过的，不存在拼写错误")
    void 副作用码全部已声明() throws Exception {
        Set<String> declared = new HashSet<>();
        for (Field f : Effect.class.getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers()) && f.getType() == String.class) {
                declared.add((String) f.get(null));
            }
        }

        List<String> unknown = REGISTRY.allMachines().stream()
                .flatMap(m -> m.transitions().stream())
                .flatMap(t -> t.effects().stream())
                .distinct()
                .filter(e -> !declared.contains(e))
                .filter(e -> !e.startsWith("DERIVE_TASK:") && !e.startsWith("SET_SUB_STATE:"))
                .toList();

        assertThat(unknown).as("这些副作用码没在 Effect 里声明，可能是拼写错误").isEmpty();
    }

    private static Transition transitionOf(RequirementTransitionCsv row) {
        return REGISTRY.requireMachine(row.objectType(), row.stateField()).transitions().stream()
                .filter(t -> Objects.equals(t.from(), row.fromOrNull()))
                .filter(t -> t.actionLabel().equals(row.actionLabel()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("引擎缺少转换：" + row));
    }
}
