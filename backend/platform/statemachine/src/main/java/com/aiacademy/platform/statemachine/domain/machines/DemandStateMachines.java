package com.aiacademy.platform.statemachine.domain.machines;

import static com.aiacademy.platform.statemachine.domain.Transition.of;

import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.SimpleStateMachineDef;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import java.util.List;
import java.util.Set;

/**
 * AI需求的 5 个状态机，来源需求文档 5.2。
 *
 * <p>需求采用「一个分流出口字段 + 两组状态字段」的结构，分流出口决定后续激活哪一组。
 * <b>出口只有两个值</b>——V1.1 的「出口三：已有工具可直接复用」已由议题 1 更新答复与 D19 取消，
 * 不实现「复用工具名称」字段与出口三的字段隐藏逻辑。（《开发实施文档》5.1.6 仍写着「按需求文档
 * 描述实现出口三」，那是 V1.1 的遗留，以需求 V1.2 为准。）
 */
public final class DemandStateMachines {

    public static final String OBJECT_TYPE = "DEMAND";

    private DemandStateMachines() {
    }

    /** 需求 5.2.1 需求评审状态（必填，全需求适用）。 */
    public static StateMachineDef review() {
        return new SimpleStateMachineDef("需求评审状态", OBJECT_TYPE, "需求评审状态", List.of(
                of(null, "REGISTER", "登记需求", "待评审",
                        Effect.deriveTask("需求评审")),
                of("待评审", "START_REVIEW", "开始评审", "评审中"),
                of("评审中", "RECORD_REVIEW_RESULT", "录入评审结论", "已评审",
                        Effect.REQUIRE_OUTLET),
                of("评审中", "RETURN_TO_PENDING_REVIEW", "退回待评审", "待评审"),
                of("已评审", "REOPEN_REVIEW", "重新评审", "评审中",
                        Effect.CONFIRM_CLEAR_OUTLET)));
    }

    /** 需求 5.2.3 解决方案状态（仅出口一适用）。 */
    public static StateMachineDef solution() {
        return new SimpleStateMachineDef("解决方案状态", OBJECT_TYPE, "解决方案状态", List.of(
                of(null, "CREATE_SOLUTION", "输出解决方案", "已输出"),
                of("已输出", "PUBLISH_SOLUTION", "发布解决方案", "已发布"),
                of("已发布", "RETURN_FOR_REVISION", "退回修改", "已输出")));
    }

    /**
     * 需求 5.2.4 需求开发状态（仅出口二适用）。
     *
     * <p>「已上线 → 优化中 → 已上线」构成循环，<b>不设次数上限</b>（议题 2 确认）。
     * 因此效率指标必须取<b>首次</b>到达「已上线」的时间（需求 15.2、CLAUDE.md 第八节第 5 条）；
     * 写成 MAX(变更时间) 会把周期无限拉长。
     */
    public static StateMachineDef development() {
        return new SimpleStateMachineDef("需求开发状态", OBJECT_TYPE, "需求开发状态", List.of(
                of(null, "INITIATE", "立项", "已立项"),
                of("已立项", "ENQUEUE", "进入排队", "待开发"),
                of("待开发", "START_DEVELOP", "开始开发", "开发中"),
                of("开发中", "GO_LIVE", "上线", "已上线"),
                of("已上线", "START_OPTIMIZE", "转入优化", "优化中"),
                of("优化中", "OPTIMIZE_GO_LIVE", "优化上线", "已上线"),
                of("开发中", "RETURN_TO_PENDING_DEVELOP", "退回待开发", "待开发")));
    }

    /**
     * 需求 5.2.5 业务验收状态。V1.2 依 C06 在交付与归档之间新增。
     *
     * <p>验收发生在线下（业务接口人当面确认），平台只记录结论。<b>不新增「业务接口人」角色</b>，
     * 验收人是自由填写的文本字段（≤50 字），不与人员表关联——业务接口人可能是平台外的人。
     */
    public static StateMachineDef acceptance() {
        return new SimpleStateMachineDef("需求业务验收状态", OBJECT_TYPE, "业务验收状态", List.of(
                of(null, "MARK_DELIVERED", "标记交付使用", "待验收",
                        Effect.SET_DELIVERED_AT, Effect.deriveTask("业务验收")),
                of("待验收", "RECORD_ACCEPTANCE_PASS", "录入验收结论=通过", "验收通过",
                        Effect.RECORD_ACCEPTANCE),
                of("待验收", "RECORD_ACCEPTANCE_REJECT", "录入验收结论=不通过", "验收不通过",
                        Effect.RECORD_ACCEPTANCE, Effect.REVERT_BY_OUTLET),
                of("验收不通过", "RESUBMIT_ACCEPTANCE", "重新提交验收", "待验收",
                        Effect.INCREMENT_ACCEPTANCE_ROUND)));
    }

    /**
     * 需求 5.2.5「前置与终态」表：交付使用标记与归档标记。需求 5.13 清单第 5 项「需求交付标记」。
     *
     * <p><b>这张表是 16 张里唯一手工转录的一张</b>，因此不进解析脚本的 CSV，也不参与参数化测试的逐行比对。
     * 原因是它的源表列头是「前置 / 动作 / 结果 / 执行人」，没有「当前状态 / 目标状态」两列，
     * 机械解析会解出错误结构。状态取值按 5.13「状态值数 2」与源表两行动作推导为「已交付 → 已归档」。
     * <b>人工验收时这一张需要单独对着需求 5.2.5 看。</b>
     *
     * <p>归档的前置「业务验收状态=验收通过」是 C9 三处例外之一，硬阻断：
     * 未验收通过的需求点归档要被拒绝并提示「该需求尚未业务验收通过」（验收点 A1-8）。
     */
    public static StateMachineDef deliveryMark() {
        return new SimpleStateMachineDef("需求交付标记", OBJECT_TYPE, "需求交付标记", Set.of("已归档"), List.of(
                of(null, "MARK_DELIVERED", "标记交付使用", "已交付",
                        Effect.SET_DELIVERED_AT),
                of("已交付", "ARCHIVE", "归档", "已归档",
                        Effect.REQUIRE_ACCEPTANCE_PASSED)
                        .exitingWarningScope()));
    }

    public static List<StateMachineDef> all() {
        return List.of(review(), solution(), development(), acceptance(), deliveryMark());
    }
}
