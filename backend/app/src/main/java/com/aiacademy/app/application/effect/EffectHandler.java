package com.aiacademy.app.application.effect;

/**
 * 一类副作用的执行器（《开发实施文档》5.1.5 的 {@code effectExecutor}）。
 *
 * <p>需求文档第 5 章转换表的「系统副作用」列<b>不是注释，是必须实现的行为</b>。实现放在 app 层
 * 而不是平台层，是因为结构类副作用要动业务表，而平台模块不得依赖业务模块（AR-2）。
 *
 * <p><b>实现必须在调用方的事务内同步完成</b>（5.1.5：结构类与联动类都是「不可失败，同步」）。
 * 不要在实现里开新事务，也不要吞异常——副作用失败时整次状态转换应当一并回滚。
 */
public interface EffectHandler {

    /**
     * 是否处理这个副作用码。
     *
     * <p>码值可能带参数（{@code SET_SUB_STATE:课程开发状态=待开发}），因此判定用前缀而不是相等。
     */
    boolean supports(String effectCode);

    void handle(EffectContext context, String effectCode);
}
