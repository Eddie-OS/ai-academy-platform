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

    /**
     * 五个状态字段名。业务模块要按字段名调状态机，只能引用这里的常量。
     *
     * <p>字段名是<b>状态机的对外契约</b>（转换接口的 {@code stateField} 入参），不是状态值。
     * 业务侧硬编码状态<b>值</b>由 A-6 的门禁禁止；字段名抄错时的症状是「状态字段 xxx 不存在」，
     * 当场就能发现，但既然可以不抄，就不抄。
     */
    public static final String FIELD_REVIEW_STATE = "需求评审状态";
    public static final String FIELD_SOLUTION_STATE = "解决方案状态";
    public static final String FIELD_DEV_STATE = "需求开发状态";
    public static final String FIELD_ACCEPTANCE_STATE = "业务验收状态";
    public static final String FIELD_DELIVERY_MARK = "需求交付标记";

    /** 新建需求时的初始转换（空 → 待评审）。 */
    public static final String ACTION_REGISTER = "REGISTER";

    /** 录入评审结论（评审中 → 已评审）。必须同时填写分流出口，见 {@link Effect#REQUIRE_OUTLET}。 */
    public static final String ACTION_RECORD_REVIEW_RESULT = "RECORD_REVIEW_RESULT";

    /** 重新评审（已评审 → 评审中）。会清空分流出口，见 {@link Effect#CONFIRM_CLEAR_OUTLET}。 */
    public static final String ACTION_REOPEN_REVIEW = "REOPEN_REVIEW";

    /** 输出解决方案（空 → 已输出）。出口一专用，与解决方案名称一起录入。 */
    public static final String ACTION_CREATE_SOLUTION = "CREATE_SOLUTION";

    /** 退回修改（已发布 → 已输出）。出口一验收不通过时的退回目标，见 {@link Effect#REVERT_BY_OUTLET}。 */
    public static final String ACTION_RETURN_FOR_REVISION = "RETURN_FOR_REVISION";

    /**
     * 标记交付使用。<b>同一个动作码同时出现在业务验收状态与需求交付标记两张表里</b>
     * （需求 5.2.5 的两张表都由这一次点击驱动），因此两次转换都要执行。
     */
    public static final String ACTION_MARK_DELIVERED = "MARK_DELIVERED";

    /** 录入验收结论＝通过（待验收 → 验收通过）。 */
    public static final String ACTION_RECORD_ACCEPTANCE_PASS = "RECORD_ACCEPTANCE_PASS";

    /** 录入验收结论＝不通过（待验收 → 验收不通过）。 */
    public static final String ACTION_RECORD_ACCEPTANCE_REJECT = "RECORD_ACCEPTANCE_REJECT";

    private DemandStateMachines() {
    }

    /** 需求 5.2.1 需求评审状态（必填，全需求适用）。 */
    public static StateMachineDef review() {
        return new SimpleStateMachineDef("需求评审状态", OBJECT_TYPE, FIELD_REVIEW_STATE, List.of(
                of(null, ACTION_REGISTER, "登记需求", "待评审",
                        Effect.deriveTask("需求评审")),
                of("待评审", "START_REVIEW", "开始评审", "评审中"),
                of("评审中", ACTION_RECORD_REVIEW_RESULT, "录入评审结论", "已评审",
                        Effect.REQUIRE_OUTLET),
                of("评审中", "RETURN_TO_PENDING_REVIEW", "退回待评审", "待评审"),
                of("已评审", ACTION_REOPEN_REVIEW, "重新评审", "评审中",
                        Effect.CONFIRM_CLEAR_OUTLET)));
    }

    /** 需求 5.2.3 解决方案状态（仅出口一适用）。 */
    public static StateMachineDef solution() {
        return new SimpleStateMachineDef("解决方案状态", OBJECT_TYPE, FIELD_SOLUTION_STATE, List.of(
                of(null, ACTION_CREATE_SOLUTION, "输出解决方案", "已输出"),
                of("已输出", "PUBLISH_SOLUTION", "发布解决方案", "已发布"),
                of("已发布", ACTION_RETURN_FOR_REVISION, "退回修改", "已输出")));
    }

    /**
     * 需求 5.2.4 需求开发状态（仅出口二适用）。
     *
     * <p>「已上线 → 优化中 → 已上线」构成循环，<b>不设次数上限</b>（议题 2 确认）。
     * 因此效率指标必须取<b>首次</b>到达「已上线」的时间（需求 15.2、CLAUDE.md 第八节第 5 条）；
     * 写成 MAX(变更时间) 会把周期无限拉长。
     *
     * <p><b>本表的三个副作用码不来自需求 5.2.4 的副作用列</b>（那一列整列只写「写日志」），
     * 而来自字段清单 8.3.3 第 25～27 项对「首次上线时间 / 最新上线时间 / 优化次数」三个自动字段
     * 的要求。两处的不一致已记入 {@code docs/文档待修清单.md}；在需求补齐之前按字段清单实现，
     * 否则这三个字段永远是空的，而它们中的第一个是需求处理周期指标的终点。
     */
    public static StateMachineDef development() {
        return new SimpleStateMachineDef("需求开发状态", OBJECT_TYPE, FIELD_DEV_STATE, List.of(
                of(null, "INITIATE", "立项", "已立项"),
                of("已立项", "ENQUEUE", "进入排队", "待开发"),
                of("待开发", "START_DEVELOP", "开始开发", "开发中"),
                of("开发中", "GO_LIVE", "上线", "已上线",
                        Effect.SET_ONLINE_DATES),
                of("已上线", "START_OPTIMIZE", "转入优化", "优化中",
                        Effect.INCREMENT_OPTIMIZE_COUNT),
                of("优化中", "OPTIMIZE_GO_LIVE", "优化上线", "已上线",
                        Effect.SET_ONLINE_DATES),
                of("开发中", "RETURN_TO_PENDING_DEVELOP", "退回待开发", "待开发")));
    }

    /**
     * 需求 5.2.5 业务验收状态。V1.2 依 C06 在交付与归档之间新增。
     *
     * <p>验收发生在线下（业务接口人当面确认），平台只记录结论。<b>不新增「业务接口人」角色</b>，
     * 验收人是自由填写的文本字段（≤50 字），不与人员表关联——业务接口人可能是平台外的人。
     */
    public static StateMachineDef acceptance() {
        return new SimpleStateMachineDef("需求业务验收状态", OBJECT_TYPE, FIELD_ACCEPTANCE_STATE, List.of(
                of(null, ACTION_MARK_DELIVERED, "标记交付使用", "待验收",
                        Effect.SET_DELIVERED_AT, Effect.deriveTask("业务验收")),
                of("待验收", ACTION_RECORD_ACCEPTANCE_PASS, "录入验收结论=通过", "验收通过",
                        Effect.RECORD_ACCEPTANCE),
                of("待验收", ACTION_RECORD_ACCEPTANCE_REJECT, "录入验收结论=不通过", "验收不通过",
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
     *
     * <p><b>源表第 1 行的前置「出口一：解决方案状态=已发布／出口二：需求开发状态=已上线」
     * 刻意没有实现</b>：C9 把本期允许的业务前置校验限定为三处，并明确「除此之外开发不得自行
     * 添加任何前置校验」，而这一条不在那三处里。需求 5.2.5 与 C9 在这里对不上，
     * 已记入 {@code docs/文档待修清单.md} 的 D-7 待业务方裁决；在裁决之前按 C9 办。
     */
    public static StateMachineDef deliveryMark() {
        return new SimpleStateMachineDef("需求交付标记", OBJECT_TYPE, FIELD_DELIVERY_MARK, Set.of("已归档"), List.of(
                of(null, ACTION_MARK_DELIVERED, "标记交付使用", "已交付",
                        Effect.SET_DELIVERED_AT),
                of("已交付", "ARCHIVE", "归档", "已归档",
                        Effect.REQUIRE_ACCEPTANCE_PASSED, Effect.SET_ARCHIVED_AT)
                        .exitingWarningScope()));
    }

    public static List<StateMachineDef> all() {
        return List.of(review(), solution(), development(), acceptance(), deliveryMark());
    }
}
