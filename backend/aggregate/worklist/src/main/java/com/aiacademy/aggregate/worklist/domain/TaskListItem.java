package com.aiacademy.aggregate.worklist.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 任务中心列表行（需求 13.1.1）。
 *
 * @param overdue 逾期派生标记：截止日 &lt; 今天 且 状态为待处理／处理中。不落库列。
 */
public record TaskListItem(
        Long id,
        String title,
        String taskType,
        String objectType,
        Long objectId,
        String ownerNo,
        String ownerName,
        LocalDate dueDate,
        String taskState,
        String deriveType,
        boolean overdue,
        OffsetDateTime createdAt,
        OffsetDateTime lastStateChangedAt) {
}
