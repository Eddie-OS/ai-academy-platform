package com.aiacademy.aggregate.metrics.domain;

import java.math.BigDecimal;

/**
 * 需求 15.5 全库互动指标快照（供核对表与单测）。
 */
public record InteractionMetricsSnapshot(
        long views,
        long likes,
        long comments,
        BigDecimal avgReadDurationSeconds,
        long activeCases30d,
        long publishedInRange
) {
}
