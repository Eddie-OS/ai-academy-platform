package com.aiacademy.aggregate.warning.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 预警明细一行（需求 7.5）。
 */
public record WarningDetailItem(
        String objectType,
        long objectId,
        String objectName,
        String currentState,
        String ownerNo,
        String ownerName,
        LocalDate expectFinishDate,
        OffsetDateTime lastStateChangedAt,
        String light,
        Integer lightDays,
        String lightReason
) {
}
