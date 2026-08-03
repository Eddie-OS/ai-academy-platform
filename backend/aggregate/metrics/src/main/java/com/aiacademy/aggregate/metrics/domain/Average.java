package com.aiacademy.aggregate.metrics.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;

/**
 * 均值类指标的统一封装（开发 5.5.2 U4／U5）。
 *
 * <p>无有效样本时返回 {@code null}（前端渲染「—」），与「均值恰好为 0」区分开。
 */
public final class Average {

    private Average() {
    }

    /**
     * @param values 有效样本；null 元素忽略；空集合或全 null → {@code null}
     * @return 保留 1 位小数（HALF_UP）；无有效样本时 {@code null}
     */
    public static BigDecimal of(Collection<? extends Number> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        BigDecimal sum = BigDecimal.ZERO;
        int count = 0;
        for (Number value : values) {
            if (value == null) {
                continue;
            }
            sum = sum.add(toBigDecimal(value));
            count++;
        }
        if (count == 0) {
            return null;
        }
        return sum.divide(BigDecimal.valueOf(count), 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal toBigDecimal(Number value) {
        if (value instanceof BigDecimal bd) {
            return bd;
        }
        if (value instanceof Long || value instanceof Integer || value instanceof Short || value instanceof Byte) {
            return BigDecimal.valueOf(value.longValue());
        }
        return BigDecimal.valueOf(value.doubleValue());
    }
}
