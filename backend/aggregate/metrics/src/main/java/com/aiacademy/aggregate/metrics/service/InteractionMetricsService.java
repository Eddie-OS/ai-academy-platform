package com.aiacademy.aggregate.metrics.service;

import com.aiacademy.aggregate.metrics.domain.InteractionMetricsSnapshot;
import com.aiacademy.aggregate.metrics.repository.InteractionMetricsMapper;
import com.aiacademy.aggregate.metrics.repository.QuantityMetricsMapper;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * 需求 15.5 案例互动类指标（AR-3 只读）。
 */
@Service
public class InteractionMetricsService {

    private final InteractionMetricsMapper interactionMapper;
    private final QuantityMetricsMapper quantityMapper;

    public InteractionMetricsService(InteractionMetricsMapper interactionMapper,
                                     QuantityMetricsMapper quantityMapper) {
        this.interactionMapper = interactionMapper;
        this.quantityMapper = quantityMapper;
    }

    /**
     * 全库 #1～#3／#5／#6，以及 #7（默认本自然月上架区间）。
     */
    @Transactional(readOnly = true)
    public InteractionMetricsSnapshot all() {
        ZoneId zone = ZoneId.systemDefault();
        OffsetDateTime now = OffsetDateTime.now(zone);
        OffsetDateTime monthStart = LocalDate.now(zone).withDayOfMonth(1)
                .atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime nextMonth = monthStart.plusMonths(1);
        String published = CaseStateMachines.caseState().transitions().stream()
                .filter(t -> CaseStateMachines.ACTION_AUDIT_PASS.equals(t.action()))
                .map(Transition::to)
                .findFirst()
                .orElseThrow();
        return new InteractionMetricsSnapshot(
                quantityMapper.countCaseViews(),
                quantityMapper.countCaseLikes(),
                quantityMapper.countCaseComments(),
                interactionMapper.avgReadDurationSeconds(),
                interactionMapper.countActiveCases(now.minusDays(30)),
                interactionMapper.countCasesPublishedBetween(published, monthStart, nextMonth));
    }

    @Transactional(readOnly = true)
    public long views(long caseId) {
        return interactionMapper.viewsByCase(caseId);
    }

    @Transactional(readOnly = true)
    public long likes(long caseId) {
        return interactionMapper.likesByCase(caseId);
    }

    @Transactional(readOnly = true)
    public long comments(long caseId) {
        return interactionMapper.commentsByCase(caseId);
    }
}
