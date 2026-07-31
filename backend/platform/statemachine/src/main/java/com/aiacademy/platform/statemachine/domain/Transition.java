package com.aiacademy.platform.statemachine.domain;

import java.util.List;

/**
 * 一条状态转换，对应需求文档第 5 章转换表里的一行。
 *
 * <p><b>这些数据必须逐字来自需求第 5 章，不得自行增补任何转换。</b>
 * 校验手段是参数化测试：{@code scripts/statemachine/extract-transitions.mjs} 从需求文档的
 * markdown 表格机械解析出 CSV，测试拿 CSV 逐行驱动本表。转录错误会红灯。
 *
 * @param from 当前状态。<b>null 表示对象新建或该状态字段尚未置值</b>（需求表格里写作「（新建）」「（空）」）。
 *             注意「（空）」也可以作为转换目标出现（5.4.2 取消自检），那时它是真实状态而非伪状态。
 * @param action 英文动作码，接口契约用（《开发实施文档》7.4 的 {@code POST /api/{objectType}/{id}/transitions}）
 * @param actionLabel 中文动作名，<b>必须与需求第 5 章「动作」列逐字一致</b>。
 *                    它既是参数化测试与需求文档对账的连接键，也是 7.4 里 available 接口返回的 label
 * @param to 目标状态
 * @param effects 副作用码，见 {@link Effect}。<b>不含「写日志」</b>——规则 C4 让它对每条转换无条件成立，
 *                建模成可选副作用反而给了漏写的空间
 * @param exitsWarningScope 需求转换表标注「退出预警范围」。
 *                          <b>这与终态是两个概念</b>：培训计划「已完成」退出预警但可以退回「执行中」，
 *                          合并成一个标志会导致退回后预警不再恢复
 */
public record Transition(
        String from,
        String action,
        String actionLabel,
        String to,
        List<String> effects,
        boolean exitsWarningScope) {

    public Transition {
        effects = effects == null ? List.of() : List.copyOf(effects);
    }

    /**
     * 需求文档 5.1 规则 C8：<b>全部状态变更的执行者都是运营账号</b>，各转换表的「执行人」列一律为运营角色。
     *
     * <p>因此本记录<b>刻意不带执行人／ExecutorScope 字段</b>。《开发实施文档》5.1.3 的草案里有
     * {@code ExecutorScope executor}（OPERATOR / OWNER / OWNER_OR_OPERATOR），那是 V1.0 的遗留：
     * 5.3「TD-3 权限判定」在 V1.1 整节简化后，判权收敛到 PermissionInterceptor 一处（AR-7、PMI-4），
     * 业务代码不得比较账号类型、不得读 owner_id 判权。
     *
     * <p>保留 OWNER 语义的后果 CLAUDE.md 第八节第 1 条已经写明：它能编译、能通过大部分测试
     * （测试数据里运营恰好是负责人），只有真实使用时才暴露成「运营改不了别人负责的课程」。
     */
    public static Transition of(String from, String action, String actionLabel, String to) {
        return new Transition(from, action, actionLabel, to, List.of(), false);
    }

    public static Transition of(String from, String action, String actionLabel, String to, String... effects) {
        return new Transition(from, action, actionLabel, to, List.of(effects), false);
    }

    /** 用于需求表格标注「退出预警范围」的那几条转换。 */
    public Transition exitingWarningScope() {
        return new Transition(from, action, actionLabel, to, effects, true);
    }
}
