package com.aiacademy.app.web.dto;

import com.aiacademy.business.demand.domain.DemandAcceptance;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 业务验收记录的出参（详情页「业务验收」页签，需求 8.2）。
 *
 * <p>结论只有通过／不通过加一段意见——<b>没有价值量化字段</b>（N14）。前端不要在这里加
 * 「效率提升多少」这类列，那属于二期。
 */
public record DemandAcceptanceVO(
        Long id,
        Long demandId,
        Integer roundNo,
        String acceptorName,
        LocalDate acceptedAt,
        String acceptanceResult,
        String acceptanceOpinion,
        OffsetDateTime createdAt,
        String createdBy) {

    public static DemandAcceptanceVO of(DemandAcceptance a) {
        return new DemandAcceptanceVO(a.id(), a.demandId(), a.roundNo(), a.acceptorName(),
                a.acceptedAt(), a.acceptanceResult(), a.acceptanceOpinion(),
                a.createdAt(), a.createdBy());
    }
}
