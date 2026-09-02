package com.aiacademy.app.web.dto;

import com.aiacademy.business.lecturer.domain.CertificationRecord;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record CertificationRecordVO(
        Long id,
        Long lecturerId,
        String certBatch,
        String lecturerLevel,
        String certState,
        String reviewers,
        String opinion,
        LocalDate passedOn,
        LocalDate validFrom,
        LocalDate validTo,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static CertificationRecordVO of(CertificationRecord r) {
        return new CertificationRecordVO(
                r.getId(), r.getLecturerId(), r.getCertBatch(), r.getLecturerLevel(),
                r.getCertState(), r.getReviewers(), r.getOpinion(), r.getPassedOn(),
                r.getValidFrom(), r.getValidTo(), r.getCreatedAt(), r.getCreatedBy(),
                r.getUpdatedAt(), r.getUpdatedBy());
    }
}
