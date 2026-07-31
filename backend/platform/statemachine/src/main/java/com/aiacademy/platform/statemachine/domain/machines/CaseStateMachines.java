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
        return new SimpleStateMachineDef("案例状态", OBJECT_TYPE, "案例状态", List.of(
                of(null, "CREATE_BY_COURSE_QUALIFIED", "课程主状态变为\"精品案例\"", "待整理",
                        Effect.deriveTask("案例整理")),
                of("待整理", "START_ORGANIZE", "开始整理", "整理中"),
                of("整理中", "SUBMIT_AUDIT", "提交审核", "待审核",
                        Effect.deriveTask("案例审核")),
                of("待审核", "AUDIT_PASS", "录入审核结论=通过", "已上架",
                        Effect.RECORD_CASE_AUDIT, Effect.SET_CASE_PUBLISHED_AT),
                of("待审核", "AUDIT_REJECT", "录入审核结论=不通过", "整理中",
                        Effect.RECORD_CASE_AUDIT),
                of("已上架", "UNPUBLISH_FOR_REVISION", "下架修改", "整理中")));
    }

    public static List<StateMachineDef> all() {
        return List.of(caseState());
    }
}
