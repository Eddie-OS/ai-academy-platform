package com.aiacademy.business.training.domain;

import java.math.BigDecimal;

/**
 * 一个场次的学员反馈汇总（需求 11.7 页签汇总区）。
 *
 * <p>匿名反馈同样计入平均分与各分档（规则 FB3）：匿名影响的是「能不能看到是谁写的」，
 * 不影响统计。
 *
 * @param averageScore   一位小数。<b>无反馈时为 null 而不是 0</b>——需求 3.3 规定「—」表示无数据，
 *                       0 分是个真实的差评，两者不能混
 * @param anonymousCount 匿名条数，只用于告诉运营「这批反馈有多少是匿名的」
 */
public record FeedbackSummary(
        long total,
        BigDecimal averageScore,
        long score5,
        long score4,
        long score3,
        long score2,
        long score1,
        long anonymousCount) {
}
