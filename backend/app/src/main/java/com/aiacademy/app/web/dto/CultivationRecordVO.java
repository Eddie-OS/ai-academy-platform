package com.aiacademy.app.web.dto;

import com.aiacademy.business.lecturer.domain.CultivationRecord;
import com.aiacademy.common.json.JsonArrays;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 培养计划与培养记录出参。讲师ID／姓名由调用方从当前讲师带出，不在行上重复存。
 */
public record CultivationRecordVO(
        Long id,
        Long lecturerId,
        String planText,
        LocalDate plannedFrom,
        LocalDate plannedTo,
        List<String> cultivationTypes,
        String recordText,
        LocalDate actualFrom,
        LocalDate actualTo,
        String planState,
        String evaluation,
        String remark,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static CultivationRecordVO of(CultivationRecord r) {
        return new CultivationRecordVO(
                r.getId(), r.getLecturerId(), r.getPlanText(),
                r.getPlannedFrom(), r.getPlannedTo(),
                JsonArrays.toList(r.getCultivationTypes()),
                r.getRecordText(), r.getActualFrom(), r.getActualTo(),
                r.getPlanState(), r.getEvaluation(), r.getRemark(),
                r.getCreatedAt(), r.getCreatedBy(), r.getUpdatedAt(), r.getUpdatedBy());
    }
}
