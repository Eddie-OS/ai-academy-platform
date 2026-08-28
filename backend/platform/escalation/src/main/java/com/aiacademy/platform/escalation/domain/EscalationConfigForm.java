package com.aiacademy.platform.escalation.domain;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 催办配置更新表单（需求 13.9.5）。
 */
public record EscalationConfigForm(
        @NotNull @Min(1) @Max(7) Integer cycleWeekday,
        @NotBlank String cycleTime,
        @NotNull Boolean listEnabled,
        @NotNull Boolean appendBlue,
        @NotNull Boolean appendYellow,
        @NotNull Boolean appendRed,
        @NotBlank @Size(max = 2000) String templateText,
        @NotNull @Min(1) @Max(168) Integer minIntervalHours,
        @NotNull @Min(0) @Max(30) Integer preSessionDays
) {
}
