package com.aiacademy.aggregate.metrics.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 比率类指标的统一封装（开发 5.5.2 U3／U5）。
 *
 * <p>分母为 0 时返回 {@code null}（序列化为 JSON {@code null}，前端渲染「—」），
 * <b>绝不能返回 0</b>——否则「真的是 0%」与「无数据」无法区分。
 */
public final class Ratio {

    private Ratio() {
    }

    /**
     * @return 保留 1 位小数（HALF_UP）的百分比数值；分母为 0 时 {@code null}
     */
    public static BigDecimal of(long numerator, long denominator) {
        if (denominator == 0L) {
            return null;
        }
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 1, RoundingMode.HALF_UP);
    }

    /** 与 {@link #of(long, long)} 相同，接受可能为 null 的计数（null 视为 0）。 */
    public static BigDecimal of(Long numerator, Long denominator) {
        long den = denominator == null ? 0L : denominator;
        long num = numerator == null ? 0L : numerator;
        return of(num, den);
    }
}
