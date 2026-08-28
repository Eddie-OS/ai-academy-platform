package com.aiacademy.aggregate.metrics.domain;

import java.math.BigDecimal;

/**
 * 需求 15.3 全局／参数化指标快照（供核对表与单测）。
 *
 * <p>#1～#4／#8 依赖讲师／场次／试讲 ID，经 Service 方法按参查询；本快照只收全局项与驾驶舱卡同源计数。
 */
public record LecturerMetricsSnapshot(
        long teachingSessionsThisMonth,
        long activeLecturers90d,
        BigDecimal avgGlobalScore
) {
}
