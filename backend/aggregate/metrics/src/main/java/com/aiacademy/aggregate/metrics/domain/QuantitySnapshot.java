package com.aiacademy.aggregate.metrics.domain;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 需求 15.1 全部数量类指标的一次快照。
 *
 * <p>key 为条目号（{@code "1"}／{@code "5a"}／…），value 为 COUNT 结果；
 * 分组指标（#2／#3／#4／#12b）的 value 为 {@code Map<String, Long>}。
 */
public record QuantitySnapshot(Map<String, Object> values) {

    public long asLong(String id) {
        Object v = values.get(id);
        if (v instanceof Number n) {
            return n.longValue();
        }
        throw new IllegalArgumentException("指标 " + id + " 不是标量：" + v);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Long> asGroup(String id) {
        Object v = values.get(id);
        if (v instanceof Map<?, ?> map) {
            return (Map<String, Long>) map;
        }
        throw new IllegalArgumentException("指标 " + id + " 不是分组：" + v);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private final Map<String, Object> values = new LinkedHashMap<>();

        public Builder put(String id, long value) {
            values.put(id, value);
            return this;
        }

        public Builder putGroup(String id, Map<String, Long> group) {
            values.put(id, Map.copyOf(group));
            return this;
        }

        public QuantitySnapshot build() {
            return new QuantitySnapshot(Map.copyOf(values));
        }
    }
}
