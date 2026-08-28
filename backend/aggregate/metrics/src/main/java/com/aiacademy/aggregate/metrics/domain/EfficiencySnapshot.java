package com.aiacademy.aggregate.metrics.domain;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 需求 15.2 全部效率类指标的一次快照。
 *
 * <p>key 为条目号（{@code "1"}…{@code "9"}），value 为 {@link BigDecimal} 或 {@code null}（无样本 →「—」）。
 */
public record EfficiencySnapshot(Map<String, BigDecimal> values) {

    public BigDecimal get(String id) {
        return values.get(id);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private final Map<String, BigDecimal> values = new LinkedHashMap<>();

        public Builder put(String id, BigDecimal value) {
            values.put(id, value);
            return this;
        }

        public EfficiencySnapshot build() {
            // 允许 value=null（无样本 →「—」）；Map.copyOf 禁止 null value
            return new EfficiencySnapshot(Collections.unmodifiableMap(new LinkedHashMap<>(values)));
        }
    }
}
