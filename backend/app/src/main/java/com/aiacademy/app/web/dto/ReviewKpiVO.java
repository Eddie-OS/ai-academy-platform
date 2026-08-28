package com.aiacademy.app.web.dto;

public record ReviewKpiVO(
        long courseReviewMonth,
        long trialMonth,
        long demandReviewTotal,
        long pendingTotal
) {
}
