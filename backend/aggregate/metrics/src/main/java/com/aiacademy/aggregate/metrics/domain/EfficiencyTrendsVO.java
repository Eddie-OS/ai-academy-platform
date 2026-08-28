package com.aiacademy.aggregate.metrics.domain;

import java.util.List;
import java.util.Map;

/**
 * 总看板 E 区近 6 个月趋势（需求 7.7／U7／15.2.3）。
 *
 * <p>{@code months} 固定 6 格（含无样本月）；{@code series} 值为字符串或 {@code null}（「—」）。
 */
public record EfficiencyTrendsVO(
        List<String> months,
        Map<String, List<String>> series
) {
}
