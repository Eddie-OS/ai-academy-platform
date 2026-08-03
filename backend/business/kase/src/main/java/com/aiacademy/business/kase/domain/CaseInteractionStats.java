package com.aiacademy.business.kase.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 一个案例的四项互动计数（需求 12.3 第 17、18、19、21 项，公式见 15.5）。
 *
 * <p><b>这四项永远是现算的，主表没有对应的列。</b>三张互动明细表本身就是唯一真相，存一份计数器
 * 只会与明细漂移：运营删掉一条评论，计数器不减，页面上就永远差一条，而没有任何报错。
 *
 * @param viewCount   浏览次数。<b>不去重</b>——共享账号下系统不知道是谁，V1.1 的「同一人同一天
 *                    只计 1 次」无法实现（需求 12.4）。它的含义因此是「被打开了多少次」而不是
 *                    「多少人看过」
 * @param likeCount   点赞量。不去重、不可取消
 * @param commentCount 评论数，<b>不含已逻辑删除的评论</b>
 * @param readSeconds 累计阅读时长（秒）
 */
public record CaseInteractionStats(long viewCount, long likeCount, long commentCount,
                                   long readSeconds) {

    /**
     * 平均阅读时长（秒）。没人打开过、或打开了但一次时长都没回报上来时是<b>无数据</b>而不是
     * 0 秒，见设计规范 3.3。
     *
     * <p>累计时长为 0 就等于「一次都没回报」：非正的时长在
     * {@code CaseInteractionService.cap} 那里已经丢掉了，落库的每一条都至少 1 秒。
     *
     * <p><b>{@code @JsonProperty} 不能省。</b>Jackson 序列化 record 时只认四个组件，这个派生
     * 访问器不在其中——不标注的话接口少一个字段，而页面上的表现只是平均阅读时长恒为「—」，
     * 与「确实没人回报过时长」一模一样。
     */
    @JsonProperty("avgReadSeconds")
    public Double avgReadSeconds() {
        return viewCount == 0 || readSeconds == 0 ? null : (double) readSeconds / viewCount;
    }
}
