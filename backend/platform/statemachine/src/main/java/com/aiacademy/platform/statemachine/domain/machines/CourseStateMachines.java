package com.aiacademy.platform.statemachine.domain.machines;

import static com.aiacademy.platform.statemachine.domain.Transition.of;

import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.SimpleStateMachineDef;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import java.util.List;
import java.util.Set;

/**
 * 课程的 5 个状态机（主状态 + 4 组子状态），来源需求文档 5.3、5.4。
 *
 * <p>议题 6 确认「主状态 + 子状态」双层设计，子状态共 4 组 8 值，<b>各组独立，不做组合校验</b>。
 *
 * <p><b>课程有效期是字段不是状态。</b>课程到期后系统只在列表打「已过期」标签，不改变主状态、
 * 不阻断排课（需求 9.3、11.4），一期不做下架流程。过期标记不落库、实时计算，
 * 也<b>不写状态流转日志</b>（CLAUDE.md 第八节第 6 条）——写进去会污染效率统计。
 */
public final class CourseStateMachines {

    public static final String OBJECT_TYPE = "COURSE";

    private CourseStateMachines() {
    }

    /**
     * 需求 5.3.1 课程主状态。12 个状态值：正向主线 10 个 + 终止出口「已关闭」+ 非精品「课程归档」。
     *
     * <p>需求表格第 15 行一行写了 4 个起始状态（立项 / 开发 / 自检 / 优化），在这里展开成 4 条转换，
     * 合计 18 条。这条「早期即可关闭」是 V1.2 确认保留的：不允许早期关闭会让被判定不做的课程
     * 永久挂在开发中并持续报红灯。
     */
    public static StateMachineDef mainState() {
        return new SimpleStateMachineDef("课程主状态", OBJECT_TYPE, "课程主状态",
                // 需求 13.1.2 自动关闭规则点名的三个课程终态。「精品案例」不是终态：它还要走到案例归档
                Set.of("已关闭", "课程归档", "案例归档"), List.of(
                of(null, "INITIATE", "课程立项", "立项",
                        Effect.deriveTask("课程开发")),
                of("立项", "START_DEVELOP", "开始开发", "开发",
                        Effect.setSubState("课程开发状态", "待开发")),
                of("开发", "ENTER_SELF_CHECK", "进入自检", "自检",
                        Effect.setSubState("课程开发状态", "自检中")),
                of("自检", "SUBMIT_REVIEW", "提交评审", "评审决策",
                        Effect.SNAPSHOT_MATERIAL, Effect.CREATE_REVIEW_ROUND,
                        Effect.deriveTask("课程评审")),
                of("评审决策", "REVIEW_PASS", "录入结论=通过", "试讲",
                        Effect.setSubState("试讲状态", "待试讲"), Effect.deriveTask("讲师试讲")),
                of("评审决策", "REVIEW_REJECT_REVISE", "录入结论=不通过·修改后重新评审", "优化",
                        Effect.deriveTask("课程优化")),
                of("评审决策", "REVIEW_REJECT_CLOSE", "录入结论=不通过·关闭", "已关闭",
                        Effect.CLOSE_RELATED_TASKS)
                        .exitingWarningScope(),
                of("优化", "RESUBMIT_REVIEW", "再次提交评审", "评审决策",
                        Effect.SNAPSHOT_MATERIAL, Effect.CREATE_REVIEW_ROUND),
                of("试讲", "TRIAL_COURSE_PASS", "录入试讲课程结论=合格", "发布",
                        Effect.setSubState("课程发布状态", "已发布"), Effect.SET_FIRST_PUBLISHED_AT),
                of("试讲", "TRIAL_COURSE_FAIL", "录入试讲课程结论=不合格", "优化"),
                of("发布", "ENTER_PROMOTION", "进入推广", "推广"),
                of("推广", "MARK_QUALIFIED", "标注达到精品标准", "精品案例",
                        Effect.CREATE_CASE),
                of("推广", "MARK_NOT_QUALIFIED", "标注未达精品标准", "课程归档")
                        .exitingWarningScope(),
                of("精品案例", "ARCHIVE_AFTER_CASE_PUBLISHED", "案例上架后归档", "案例归档")
                        .exitingWarningScope(),
                // 需求表格第 15 行：立项 / 开发 / 自检 / 优化 → 关闭课程开发 → 已关闭。
                // 需求 V1.3 给这一行补上了原先漏标的「退出预警范围」——目标状态与第 7 行同为终态
                // 「已关闭」，预警行为不可能不同。
                of("立项", "CLOSE_DEVELOPMENT", "关闭课程开发", "已关闭", Effect.CLOSE_RELATED_TASKS)
                        .exitingWarningScope(),
                of("开发", "CLOSE_DEVELOPMENT", "关闭课程开发", "已关闭", Effect.CLOSE_RELATED_TASKS)
                        .exitingWarningScope(),
                of("自检", "CLOSE_DEVELOPMENT", "关闭课程开发", "已关闭", Effect.CLOSE_RELATED_TASKS)
                        .exitingWarningScope(),
                of("优化", "CLOSE_DEVELOPMENT", "关闭课程开发", "已关闭", Effect.CLOSE_RELATED_TASKS)
                        .exitingWarningScope()));
    }

    /**
     * 需求 5.4.1 课程开发状态。值域「待开发 / 开发中 / 自检中」。
     *
     * <p>需求 5.13 的「状态值数」列曾写 2，与本表和课程字段清单第 14 项（值域明确为三值）都不一致。
     * 按两个独立来源一致的三值实现，<b>需求 V1.3 已把 5.13 改为 3</b>。
     */
    public static StateMachineDef developmentSubState() {
        return new SimpleStateMachineDef("课程开发子状态", OBJECT_TYPE, "课程开发状态", List.of(
                of(null, "MAIN_STATE_ENTERED_DEVELOP", "主状态进入\"开发\"", "待开发"),
                of("待开发", "START_DEVELOP", "开始开发", "开发中"),
                of("开发中", "ENTER_SELF_CHECK", "进入自检", "自检中"),
                of("自检中", "RETURN_TO_DEVELOP", "退回开发", "开发中")));
    }

    /**
     * 需求 5.4.2 课程自检状态。
     *
     * <p>自检是<b>纯自评</b>：按清单逐项勾选，无不通过分支、无门禁效果（议题 13）。
     * 自检未完成时<b>允许</b>提交评审，系统仅在界面提示，不阻断——加了阻断会拦住运营录入历史数据。
     *
     * <p>「取消自检」的目标是（空），所以（空）在这张表里是真实状态而非初始伪状态。
     */
    public static StateMachineDef selfCheckSubState() {
        return new SimpleStateMachineDef("课程自检子状态", OBJECT_TYPE, "课程自检状态", List.of(
                of(null, "COMPLETE_ALL_ITEMS", "全部清单项勾选完成", "自检完成"),
                of("自检完成", "CANCEL_SELF_CHECK", "取消自检", "（空）")));
    }

    /** 需求 5.4.3 试讲状态。 */
    public static StateMachineDef trialSubState() {
        return new SimpleStateMachineDef("试讲子状态", OBJECT_TYPE, "试讲状态", List.of(
                of(null, "MAIN_STATE_ENTERED_TRIAL", "主状态进入\"试讲\"", "待试讲"),
                of("待试讲", "START_TRIAL", "开始试讲", "试讲中"),
                of("试讲中", "TRIAL_COURSE_PASS", "录入试讲课程结论=合格", "待发布"),
                of("试讲中", "TRIAL_COURSE_FAIL", "录入试讲课程结论=不合格", "待试讲")));
    }

    /** 需求 5.4.4 课程发布状态。只有一条转换，随主状态置位。 */
    public static StateMachineDef publishSubState() {
        return new SimpleStateMachineDef("课程发布子状态", OBJECT_TYPE, "课程发布状态", List.of(
                of(null, "MAIN_STATE_ENTERED_PUBLISH", "主状态进入\"发布\"", "已发布")));
    }

    public static List<StateMachineDef> all() {
        return List.of(mainState(), developmentSubState(), selfCheckSubState(),
                trialSubState(), publishSubState());
    }
}
