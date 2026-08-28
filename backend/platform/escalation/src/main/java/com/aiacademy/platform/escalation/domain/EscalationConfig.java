package com.aiacademy.platform.escalation.domain;

import java.time.LocalTime;
import java.time.OffsetDateTime;

/**
 * 催办配置单行（需求 13.9.5）。
 */
public record EscalationConfig(
        long id,
        int cycleWeekday,
        LocalTime cycleTime,
        boolean listEnabled,
        boolean appendBlue,
        boolean appendYellow,
        boolean appendRed,
        String templateText,
        int minIntervalHours,
        int preSessionDays,
        OffsetDateTime updatedAt,
        String updatedBy
) {
    public boolean appendEnabledFor(String lightApi) {
        if (lightApi == null) {
            return false;
        }
        return switch (lightApi) {
            case "BLUE" -> appendBlue;
            case "YELLOW" -> appendYellow;
            case "RED" -> appendRed;
            default -> false;
        };
    }
}
