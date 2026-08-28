package com.aiacademy.aggregate.metrics.domain;

import java.math.BigDecimal;

/**
 * 驾驶舱周期卡用的效率摘要（需求 15.2 #1／#3）。
 *
 * <p>无样本时字段为 {@code null}（JSON null → 前端「—」）；有值时为保留 1 位小数的天数字符串（API-5）。
 */
public record EfficiencySummaryVO(String demandReviewCycle, String courseDevCycle) {

    public static EfficiencySummaryVO of(BigDecimal demandReviewCycle, BigDecimal courseDevCycle) {
        return new EfficiencySummaryVO(plain(demandReviewCycle), plain(courseDevCycle));
    }

    private static String plain(BigDecimal value) {
        return value == null ? null : value.toPlainString();
    }
}
