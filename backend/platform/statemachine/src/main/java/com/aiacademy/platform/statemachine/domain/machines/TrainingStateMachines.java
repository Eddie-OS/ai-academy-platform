package com.aiacademy.platform.statemachine.domain.machines;

import static com.aiacademy.platform.statemachine.domain.Transition.of;

import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.SimpleStateMachineDef;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import java.util.List;
import java.util.Set;

/**
 * 培训计划与培训场次两个状态机，来源需求文档 5.7、5.8。
 *
 * <p>依议题 24「保持现状」，一期<b>不实现培训取消、改期、换讲师流程</b>，故两者都不设「已取消」状态。
 */
public final class TrainingStateMachines {

    public static final String PLAN_OBJECT_TYPE = "TRAINING_PLAN";
    public static final String SESSION_OBJECT_TYPE = "TRAINING_SESSION";

    /**
     * 两个状态字段名。业务模块要按字段名调状态机，只能引用这里的常量。
     *
     * <p>字段名是<b>状态机的对外契约</b>（转换接口的 {@code stateField} 入参），不是状态值。
     */
    public static final String FIELD_PLAN_STATE = "培训计划状态";
    public static final String FIELD_SESSION_STATE = "培训场次状态";

    /** 新建培训计划时的初始转换（空 → 待执行）。 */
    public static final String ACTION_CREATE_PLAN = "CREATE";

    /** 新建培训场次时的初始转换（空 → 待开课）。带排课三项校验，见 {@link Effect#VALIDATE_SCHEDULING}。 */
    public static final String ACTION_CREATE_SESSION = "CREATE";

    /**
     * 场次状态值的具名引用，供需要「只有某几个状态可以做某事」的业务代码使用
     * （需求 14.4／14.6 的导入前置条件）。
     *
     * <p><b>状态值只应出现在这个模块里</b>（出口准则 E2-6）。业务代码需要按状态过滤时引用这些常量，
     * 不要在自己那边再写一遍字符串——转换表改了状态名，写死的那一份不会报错，只会静默地不再匹配。
     * 常量与转换表的一致性由 {@code StateLiteralGuardTest} 断言。
     */
    public static final String SESSION_PENDING = "待开课";
    public static final String SESSION_OPENED = "已开课";
    public static final String SESSION_FINISHED = "已结束";
    public static final String SESSION_ARCHIVED = "已归档";

    private TrainingStateMachines() {
    }

    /**
     * 需求 5.7 培训计划状态。
     *
     * <p>「已完成」标注了退出预警范围，但它<b>不是终态</b>——有一条「退回执行中」。
     * 这正是终态集合与退出预警范围必须分开建模的原因：合成一个标志，退回执行中之后预警不会恢复。
     *
     * <p>退回执行中时<b>实际完成时间保留不清空</b>（需求 5.7 第 4 条），
     * 再次进入「已完成」也不覆盖首次值——{@link Effect#SET_ACTUAL_FINISHED_AT} 只在首次进入时写。
     */
    public static StateMachineDef plan() {
        return new SimpleStateMachineDef("培训计划状态", PLAN_OBJECT_TYPE, FIELD_PLAN_STATE, List.of(
                of(null, ACTION_CREATE_PLAN, "创建培训计划", "待执行"),
                of("待执行", "FIRST_SESSION_STARTED", "首个场次开课", "执行中"),
                of("执行中", "ALL_SESSIONS_FINISHED", "全部场次结束", "已完成",
                        Effect.SET_ACTUAL_FINISHED_AT)
                        .exitingWarningScope(),
                of("已完成", "RETURN_TO_RUNNING", "退回执行中", "执行中")));
    }

    /**
     * 需求 5.8 培训场次状态。
     *
     * <p>创建时执行排课三项校验（需求 11.4），是 C9 三处例外之一——<b>本期唯一允许做业务前置校验的地方</b>
     * 之外不得自行添加任何前置校验。
     */
    public static StateMachineDef session() {
        return new SimpleStateMachineDef("培训场次状态", SESSION_OBJECT_TYPE, FIELD_SESSION_STATE,
                Set.of("已归档"), List.of(
                of(null, ACTION_CREATE_SESSION, "创建培训场次", "待开课",
                        Effect.ATTACH_TO_PLAN, Effect.VALIDATE_SCHEDULING),
                of("待开课", "START", "开课", "已开课"),
                of("已开课", "FINISH", "结束", "已结束",
                        Effect.deriveTask("签到导入"), Effect.deriveTask("培训归档")),
                of("已结束", "ARCHIVE", "完成归档", "已归档")
                        .exitingWarningScope()));
    }

    public static List<StateMachineDef> all() {
        return List.of(plan(), session());
    }
}
