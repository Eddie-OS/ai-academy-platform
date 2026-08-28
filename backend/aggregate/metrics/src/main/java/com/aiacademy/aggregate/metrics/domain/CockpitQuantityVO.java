package com.aiacademy.aggregate.metrics.domain;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 单个驾驶舱顶部指标卡的数量值（card key → 非负整数）。
 *
 * <p>Controller 返回 {@link #values()} 扁平 map，例如 {@code {"total":12,"pending":3}}。
 * 效率周期卡走 {@code /api/metrics/efficiency/summary}，不在本 VO。
 */
public record CockpitQuantityVO(Map<String, Long> values) {

    public static CockpitQuantityVO of(Map<String, Long> values) {
        return new CockpitQuantityVO(Map.copyOf(new LinkedHashMap<>(values)));
    }
}
