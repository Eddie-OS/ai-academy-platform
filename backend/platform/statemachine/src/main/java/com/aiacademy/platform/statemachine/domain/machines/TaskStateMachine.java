package com.aiacademy.platform.statemachine.domain.machines;

import static com.aiacademy.platform.statemachine.domain.Transition.of;

import com.aiacademy.platform.statemachine.domain.SimpleStateMachineDef;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import java.util.List;
import java.util.Set;

/**
 * 任务状态机，来源需求文档 5.10。
 *
 * <p><b>它不计入「15 个状态机」。</b>需求 5.13 明确把任务列在清单之外（它是支撑对象），
 * 但引擎照样要装载它——实现上是 16 张转换表，业务口径上是 15 个状态机
 * （《开发实施文档》5.1.3 的计数口径说明）。
 *
 * <p><b>「逾期任务」不是状态</b>，而是按「截止时间 &lt; 当前时间 且 状态 ∈ (待处理, 处理中)」
 * 实时计算的派生标记。任务中心的「逾期任务」页签按此条件筛选，不要给它加一个状态值。
 */
public final class TaskStateMachine {

    public static final String OBJECT_TYPE = "TASK";

    private TaskStateMachine() {
    }

    /**
     * 需求 5.10 任务状态：待处理 / 处理中 / 已完成 / 已关闭。
     *
     * <p>需求表格第 4 行一行写了两个起始状态（待处理 / 处理中），这里展开成两条转换，合计 6 条。
     *
     * <p>「已完成」有一条「重新打开」，所以只有「已关闭」是终态。
     */
    public static StateMachineDef task() {
        return new SimpleStateMachineDef("任务状态", OBJECT_TYPE, "任务状态",
                Set.of("已关闭"), List.of(
                of(null, "CREATE", "流程节点派生 或 人工创建", "待处理"),
                of("待处理", "START", "开始处理", "处理中"),
                of("处理中", "COMPLETE", "完成", "已完成"),
                // 需求表格第 4 行：待处理 / 处理中 → 关闭（业务对象已关闭时）→ 已关闭
                of("待处理", "CLOSE", "关闭（业务对象已关闭时）", "已关闭"),
                of("处理中", "CLOSE", "关闭（业务对象已关闭时）", "已关闭"),
                of("已完成", "REOPEN", "重新打开", "待处理")));
    }

    public static List<StateMachineDef> all() {
        return List.of(task());
    }
}
