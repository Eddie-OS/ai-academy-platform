package com.aiacademy.app.web.dto;

import com.aiacademy.aggregate.worklist.domain.TaskListItem;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 任务中心列表出参（需求 13.1.1）。
 *
 * @param overdue 逾期派生字段；不对应数据库列
 */
public record TaskVO(
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

    public static TaskVO of(TaskListItem item) {
        return new TaskVO(
                item.id(), item.title(), item.taskType(), item.objectType(), item.objectId(),
                item.ownerNo(), item.ownerName(), item.dueDate(), item.taskState(),
                item.deriveType(), item.overdue(), item.createdAt(), item.lastStateChangedAt());
    }
}
