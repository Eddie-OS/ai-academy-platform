package com.aiacademy.platform.escalation.domain;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;

/**
 * 待催办清单的滚动周期边界（开发 5.8.2）。
 *
 * <p>RM1「每周一 9:00 重算」用「最近一个已过去的周期起点」纯函数表达，<b>不建定时任务</b>。
 * 周一 9:00 一过，边界前移，上周的「本周期已催办」自然失效。
 */
public final class EscalationCycle {

    private EscalationCycle() {
    }

    /**
     * @param weekday ISO-8601：1=周一 … 7=周日
     * @param time    当日时刻（如 09:00）
     */
    public static OffsetDateTime currentStart(Clock clock, int weekday, LocalTime time) {
        ZoneId zone = clock.getZone();
        OffsetDateTime now = OffsetDateTime.now(clock);
        DayOfWeek target = DayOfWeek.of(weekday);
        LocalDate today = now.toLocalDate();
        LocalDate candidateDate = today.with(TemporalAdjusters.previousOrSame(target));
        OffsetDateTime candidate = candidateDate.atTime(time).atZone(zone).toOffsetDateTime();
        if (candidate.isAfter(now)) {
            candidate = candidate.minusWeeks(1);
        }
        return candidate;
    }
}
