package com.aiacademy.aggregate.metrics.service;

import com.aiacademy.aggregate.metrics.domain.LecturerMetricsSnapshot;
import com.aiacademy.aggregate.metrics.repository.LecturerMetricsMapper;
import com.aiacademy.aggregate.metrics.repository.QuantityMetricsMapper;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 需求 15.3 讲师类指标（AR-3 只读）。授课从场次派生（M-1）；评分只读正式反馈表（R10）。
 */
@Service
public class LecturerMetricsService {

    private static final String ATTEND_PRESENT = "已签到";

    private final LecturerMetricsMapper lecturerMapper;
    private final QuantityMetricsMapper quantityMapper;

    public LecturerMetricsService(LecturerMetricsMapper lecturerMapper,
                                  QuantityMetricsMapper quantityMapper) {
        this.lecturerMapper = lecturerMapper;
        this.quantityMapper = quantityMapper;
    }

    /** 全局项：本月授课人次、活跃讲师、全局均分。 */
    @Transactional(readOnly = true)
    public LecturerMetricsSnapshot all() {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        List<String> finished = finishedStates();
        return new LecturerMetricsSnapshot(
                quantityMapper.countTeachingSessionsInMonth(finished, monthStart, monthEnd),
                quantityMapper.countActiveLecturers(finished, today.minusDays(90)),
                lecturerMapper.avgGlobalLecturerScore());
    }

    @Transactional(readOnly = true)
    public long teachingCount(long lecturerId) {
        return lecturerMapper.teachingCountByLecturer(lecturerId, finishedStates());
    }

    @Transactional(readOnly = true)
    public long attendeeSum(long lecturerId) {
        return lecturerMapper.attendeeSumByLecturer(lecturerId, finishedStates(), ATTEND_PRESENT);
    }

    @Transactional(readOnly = true)
    public BigDecimal avgScore(long lecturerId) {
        return lecturerMapper.avgScoreByLecturer(lecturerId);
    }

    @Transactional(readOnly = true)
    public BigDecimal avgScoreForSession(long lecturerId, long sessionId) {
        return lecturerMapper.avgScoreByLecturerSession(lecturerId, sessionId);
    }

    @Transactional(readOnly = true)
    public BigDecimal avgTrialFeedback(long trialId) {
        return lecturerMapper.avgTrialFeedbackScore(trialId);
    }

    private static List<String> finishedStates() {
        return List.of(
                TrainingStateMachines.SESSION_FINISHED,
                TrainingStateMachines.SESSION_ARCHIVED);
    }
}
