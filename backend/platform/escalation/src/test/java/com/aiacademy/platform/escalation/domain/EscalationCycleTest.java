package com.aiacademy.platform.escalation.domain;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class EscalationCycleTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    @Test
    void 周一九点后边界为本周一九点() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-03T02:00:00Z"), ZONE); // 周一 10:00 CST
        OffsetDateTime start = EscalationCycle.currentStart(clock, 1, LocalTime.of(9, 0));
        assertThat(start.toLocalDate().toString()).isEqualTo("2026-08-03");
        assertThat(start.toLocalTime()).isEqualTo(LocalTime.of(9, 0));
    }

    @Test
    void 周一九点前边界为上周一九点() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-03T00:30:00Z"), ZONE); // 周一 08:30 CST
        OffsetDateTime start = EscalationCycle.currentStart(clock, 1, LocalTime.of(9, 0));
        assertThat(start.toLocalDate().toString()).isEqualTo("2026-07-27");
    }
}
