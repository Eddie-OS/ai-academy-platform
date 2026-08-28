package com.aiacademy.app.web.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 评审记录中心一行（需求 13.3.1）。
 */
public record ReviewRecordVO(
        String tab,
        long id,
        long objectId,
        String objectName,
        Integer roundNo,
        String boundVersion,
        LocalDate occurredOn,
        String result,
        String secondaryResult,
        Boolean inconsistent,
        String feedbackAvgScore,
        String opinion,
        String recordState,
        String operator,
        String outlet,
        String acceptorName,
        OffsetDateTime createdAt
) {
}
