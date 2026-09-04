package com.aiacademy.common.time;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class DisplayTimeTest {

    @Test
    @DisplayName("UTC 存进来的时间要按 +08:00 显示——差 8 小时的时间戳会让运营以为「那会儿没人上班」")
    void 按东八区显示() {
        // 驱动返回 Z 偏移是实测行为：同一条记录的 updated_at 走 message 拼接时是 UTC，
        // 走 Jackson 序列化时是 +08:00（application.yml 配了 jackson.time-zone）
        OffsetDateTime utc = OffsetDateTime.of(2026, 9, 4, 11, 33, 48, 166_568_000, ZoneOffset.UTC);

        assertThat(DisplayTime.human(utc)).isEqualTo("2026-09-04 19:33");
    }

    @Test
    @DisplayName("设计规范 3.3：含时间的显示不带秒，也不带 ISO 的 T 与微秒")
    void 不显示秒与微秒() {
        String text = DisplayTime.human(OffsetDateTime.of(2026, 9, 4, 19, 33, 48, 166_568_000,
                ZoneOffset.ofHours(8)));

        assertThat(text).isEqualTo("2026-09-04 19:33")
                .doesNotContain("T")
                .doesNotContain("Z")
                .doesNotContain(":48");
    }

    @Test
    @DisplayName("已经是 +08:00 的时间不该被再平移一次")
    void 东八区入参保持不变() {
        OffsetDateTime local = OffsetDateTime.of(2026, 9, 4, 19, 33, 0, 0, ZoneOffset.ofHours(8));

        assertThat(DisplayTime.human(local)).isEqualTo("2026-09-04 19:33");
    }

    @Test
    @DisplayName("空值给出「未知时间」，调用方不必各自写三元表达式")
    void 空值() {
        assertThat(DisplayTime.human(null)).isEqualTo("未知时间");
    }
}
