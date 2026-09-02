package com.aiacademy.app.web.dto;

import com.aiacademy.business.lecturer.domain.LevelLogRecord;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record LevelLogRecordVO(
        Long id,
        Long lecturerId,
        String changeNo,
        String triggerReason,
        String changeDesc,
        LocalDate changedOn,
        String levelAfter,
        String reviewer,
        String reviewComment,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static LevelLogRecordVO of(LevelLogRecord r) {
        return new LevelLogRecordVO(
                r.getId(), r.getLecturerId(), r.getChangeNo(), r.getTriggerReason(),
                r.getChangeDesc(), r.getChangedOn(), r.getLevelAfter(), r.getReviewer(),
                r.getReviewComment(), r.getCreatedAt(), r.getCreatedBy(),
                r.getUpdatedAt(), r.getUpdatedBy());
    }
}
