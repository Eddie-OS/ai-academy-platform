package com.aiacademy.platform.statemachine.domain.machines;

import static com.aiacademy.platform.statemachine.domain.Transition.of;

import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.SimpleStateMachineDef;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import java.util.List;

/**
 * 案例状态机，来源需求文档 5.9。V1.2 依议题 28 更新答复恢复审核环节，状态由三值改为四值。
 *
 * <p>一期案例<b>仅来自达到精品标准的课程</b>，由系统在课程主状态变为「精品案例」时自动创建
 * （议题 27、C16-b）。学员成果、业务侧实践等其他来源不能直接提交为案例。
 *
 * <p>类名用 {@code Case} 会撞 Java 与 SQL 保留字，按命名对照表 Java 侧一律用 {@code kase}／
 * 表名用 {@code biz_case}；这里的对象类型码是字符串，可以直接写 {@code CASE}。
 */
public final class CaseStateMachines {

    public static final String OBJECT_TYPE = "CASE";

    public static final String FIELD_CASE_STATE = "案例状态";

    /** 课程标注达精品时由 {@code CREATE_CASE} 副作用调用，运营没有「新建案例」入口（议题 27）。 */
    public static final String ACTION_CREATE_BY_COURSE_QUALIFIED = "CREATE_BY_COURSE_QUALIFIED";

    public static final String ACTION_AUDIT_PASS = "AUDIT_PASS";
    public static final String ACTION_AUDIT_REJECT = "AUDIT_REJECT";

    /**
     * 案例状态值的具名引用，供需要按状态过滤的只读查询使用（如待催办清单的案例维度计数）。
     *
     * <p><b>状态值只应出现在这个模块里</b>（出口准则 E2-6）。调用方引用常量并作为参数传给 SQL，
     * 不在 Mapper 的 SQL 文本里写死——转换表改了状态名，写死的那一份不会报错，只会静默地少算。
     * 常量与转换表的一致性由 {@code StateLiteralGuardTest} 断言。
     */
    public static final String STATE_PENDING_ORGANIZE = "待整理";
    public static final String STATE_ORGANIZING = "整理中";
    public static final String STATE_PENDING_AUDIT = "待审核";
    public static final String STATE_PUBLISHED = "已上架";

    private CaseStateMachines() {
    }

    /**
     * 需求 5.9 案例状态：待整理 / 整理中 / 待审核 / 已上架。
     *
     * <p>审核<b>不记轮次</b>：与课程评审不同，案例审核不建独立记录表、不做多轮留档，
     * 审核字段直接挂在案例主表上，后一次覆盖前一次。
     *
     * <p>「整理中不能直接跳到已上架」是 C9 三处例外之一，硬阻断。这一条不需要额外的前置校验代码——
     * 转换表里就没有「整理中 → 已上架」这一行，C3 的默认拒绝已经实现了它。
     *
     * <p>「已上架」有一条「下架修改」，所以它<b>不是终态</b>。
     */
    public static StateMachineDef caseState() {
        return new SimpleStateMachineDef("案例状态", OBJECT_TYPE, FIELD_CASE_STATE, List.of(
                of(null, ACTION_CREATE_BY_COURSE_QUALIFIED, "课程主状态变为\"精品案例\"", "待整理",
                        Effect.deriveTask("案例整理")),
                of("待整理", "START_ORGANIZE", "开始整理", "整理中"),
                of("整理中", "SUBMIT_AUDIT", "提交审核", "待审核",
                        Effect.deriveTask("案例审核")),
                of("待审核", ACTION_AUDIT_PASS, "录入审核结论=通过", "已上架",
                        Effect.RECORD_CASE_AUDIT, Effect.SET_CASE_PUBLISHED_AT),
                of("待审核", ACTION_AUDIT_REJECT, "录入审核结论=不通过", "整理中",
                        Effect.RECORD_CASE_AUDIT),
                of("已上架", "UNPUBLISH_FOR_REVISION", "下架修改", "整理中")));
    }

    public static List<StateMachineDef> all() {
        return List.of(caseState());
    }
}
