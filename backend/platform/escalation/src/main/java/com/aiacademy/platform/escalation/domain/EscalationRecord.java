package com.aiacademy.platform.escalation.domain;

import java.time.OffsetDateTime;

/**
 * 催办台账一行（开发 5.8.3 + 需求 8.5 快照列）。
 */
public record EscalationRecord(
        long id,
        String objectType,
        long objectId,
        String objectName,
        String ownerNo,
        String ownerName,
        String escalateType,
        String channelNote,
        String remark,
        OffsetDateTime escalatedAt,
        String processNode,
        String light,
        String source,
        String content,
        OffsetDateTime createdAt,
        String createdBy
) {
}
