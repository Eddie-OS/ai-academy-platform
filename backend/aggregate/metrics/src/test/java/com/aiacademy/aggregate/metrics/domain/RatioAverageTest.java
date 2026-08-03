package com.aiacademy.aggregate.metrics.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 出口准则地基：U3／U4／U5 必须在封装类里钉死，不能散落到 54 个指标 SQL 里各自 ROUND。
 */
class RatioAverageTest {

    @Test
    @DisplayName("U3：分母为 0（含 0/0）返回 null，不是 0")
    void 分母为零返回null() {
        assertThat(Ratio.of(0, 0)).isNull();
        assertThat(Ratio.of(1, 0)).isNull();
        assertThat(Ratio.of(null, 0L)).isNull();
    }

    @Test
    @DisplayName("U5：百分比保留 1 位小数；100% 仍为 100.0")
    void 百分比一位小数() {
        assertThat(Ratio.of(1, 3)).isEqualByComparingTo("33.3");
        assertThat(Ratio.of(1, 1)).isEqualByComparingTo("100.0");
        assertThat(Ratio.of(0, 5)).isEqualByComparingTo("0.0");
    }

    @Test
    @DisplayName("U4：无有效样本返回 null；有样本保留 1 位小数")
    void 均值无样本返回null() {
        assertThat(Average.of(List.of())).isNull();
        assertThat(Average.of(null)).isNull();
        assertThat(Average.of(Arrays.asList(null, null))).isNull();
        assertThat(Average.of(List.of(1, 2, 3))).isEqualByComparingTo("2.0");
        assertThat(Average.of(List.of(new BigDecimal("1.25"), new BigDecimal("1.25"))))
                .isEqualByComparingTo("1.3");
    }
}
