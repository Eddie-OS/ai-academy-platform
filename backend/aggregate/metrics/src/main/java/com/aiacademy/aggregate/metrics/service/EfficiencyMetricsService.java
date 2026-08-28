package com.aiacademy.aggregate.metrics.service;

import com.aiacademy.aggregate.metrics.domain.Average;
import com.aiacademy.aggregate.metrics.domain.CourseMonthlyOverviewVO;
import com.aiacademy.aggregate.metrics.domain.EfficiencySnapshot;
import com.aiacademy.aggregate.metrics.domain.EfficiencySummaryVO;
import com.aiacademy.aggregate.metrics.domain.EfficiencyTrendsVO;
import com.aiacademy.aggregate.metrics.domain.Ratio;
import com.aiacademy.aggregate.metrics.repository.EfficiencyMetricsMapper;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 需求 15.2 效率类指标（AR-3 只读）。首次到达用 MIN（E1）；状态从转换表推导后入参（E2-6）。
 */
@Service
public class EfficiencyMetricsService {

    /**
     * 评审／试讲结论非状态机状态值（字段枚举）。长度不足 StateLiteralGuard 门槛或未入状态集合。
     */
    private static final String REVIEW_RESULT_PASS = "通过";
    private static final String TRIAL_COURSE_QUALIFIED = "合格";

    private final EfficiencyMetricsMapper mapper;

    public EfficiencyMetricsService(EfficiencyMetricsMapper mapper) {
        this.mapper = mapper;
    }

    /** 需求 15.2 全部 9 项，供单测与总看板复用。 */
    @Transactional(readOnly = true)
    public EfficiencySnapshot all() {
        String reviewed = toState(DemandStateMachines.review(),
                DemandStateMachines.ACTION_RECORD_REVIEW_RESULT);
        List<String> deliveryMarks = allStates(DemandStateMachines.deliveryMark());
        String recordCompleted = toState(CourseRecordStateMachines.review(),
                CourseRecordStateMachines.ACTION_RECORD_RESULT);
        String planCompleted = toState(TrainingStateMachines.plan(), "ALL_SESSIONS_FINISHED");
        String casePublished = toState(CaseStateMachines.caseState(),
                CaseStateMachines.ACTION_AUDIT_PASS);

        EfficiencySnapshot.Builder b = EfficiencySnapshot.builder();
        b.put("1", Average.of(mapper.demandReviewCycleDays(
                DemandStateMachines.OBJECT_TYPE,
                DemandStateMachines.FIELD_REVIEW_STATE,
                reviewed)));
        b.put("2", Average.of(mapper.demandDeliveryCycleDays(deliveryMarks)));
        b.put("3", Average.of(mapper.courseDevCycleDays(
                CourseStateMachines.OBJECT_TYPE,
                CourseStateMachines.FIELD_MAIN_STATE,
                CourseStateMachines.MAIN_PUBLISHED)));
        b.put("4", Average.of(mapper.courseCompletedReviewRounds(recordCompleted)));
        b.put("5", ratioOf(mapper.firstRoundReviewPassCounts(recordCompleted, REVIEW_RESULT_PASS)));
        b.put("6", Average.of(mapper.courseCompletedTrialRounds(recordCompleted)));
        b.put("7", ratioOf(mapper.firstRoundTrialPassCounts(recordCompleted, TRIAL_COURSE_QUALIFIED)));
        b.put("8", Average.of(mapper.casePublishCycleDays(casePublished)));
        b.put("9", ratioOf(mapper.planOnTimeCounts(planCompleted)));
        return b.build();
    }

    /** 驾驶舱周期卡：需求平均评审周期、课程平均开发周期。 */
    @Transactional(readOnly = true)
    public EfficiencySummaryVO summary() {
        EfficiencySnapshot snap = all();
        return EfficiencySummaryVO.of(snap.get("1"), snap.get("3"));
    }

    /**
     * 课程工作台本月概览：新建数 + 一次评审通过率 + 试讲一次合格率，各带月度环比。
     *
     * <p>通过率公式与 15.2 #5／#7 相同，按 15.2.3 用第 1 轮记录日期归属月份。
     */
    @Transactional(readOnly = true)
    public CourseMonthlyOverviewVO courseMonthlyOverview() {
        YearMonth thisMonth = YearMonth.now();
        YearMonth lastMonth = thisMonth.minusMonths(1);
        LocalDate from = lastMonth.atDay(1);
        String thisKey = thisMonth.toString();
        String lastKey = lastMonth.toString();

        String completed = toState(CourseRecordStateMachines.review(),
                CourseRecordStateMachines.ACTION_RECORD_RESULT);

        Map<String, BigDecimal> review = ratioByMonth(
                mapper.firstRoundReviewPassByMonth(completed, REVIEW_RESULT_PASS, from));
        Map<String, BigDecimal> trial = ratioByMonth(
                mapper.firstRoundTrialPassByMonth(completed, TRIAL_COURSE_QUALIFIED, from));

        long thisNew = mapper.countCoursesCreatedBetween(thisMonth.atDay(1), thisMonth.plusMonths(1).atDay(1));
        long lastNew = mapper.countCoursesCreatedBetween(lastMonth.atDay(1), thisMonth.atDay(1));

        return new CourseMonthlyOverviewVO(
                Long.toString(thisNew),
                momCount(thisNew, lastNew),
                percentOf(review.get(thisKey)),
                momRate(review.get(thisKey), review.get(lastKey)),
                percentOf(trial.get(thisKey)),
                momRate(trial.get(thisKey), trial.get(lastKey)));
    }

    /**
     * 总看板 E 区近 6 个月趋势（U7）。归属按 15.2.3：终点事件落在哪个月进哪个月。
     */
    @Transactional(readOnly = true)
    public EfficiencyTrendsVO trendsLast6Months() {
        List<String> months = lastSixMonthKeys();
        LocalDate fromMonth = YearMonth.parse(months.get(0)).atDay(1);

        String reviewed = toState(DemandStateMachines.review(),
                DemandStateMachines.ACTION_RECORD_REVIEW_RESULT);
        String recordCompleted = toState(CourseRecordStateMachines.review(),
                CourseRecordStateMachines.ACTION_RECORD_RESULT);
        String casePublished = toState(CaseStateMachines.caseState(),
                CaseStateMachines.ACTION_AUDIT_PASS);

        Map<String, List<String>> series = new LinkedHashMap<>();
        series.put("demandReviewCycle", alignAvg(months, mapper.demandReviewCycleByMonth(
                DemandStateMachines.OBJECT_TYPE,
                DemandStateMachines.FIELD_REVIEW_STATE,
                reviewed,
                fromMonth)));
        series.put("courseDevCycle", alignAvg(months, mapper.courseDevCycleByMonth(
                CourseStateMachines.OBJECT_TYPE,
                CourseStateMachines.FIELD_MAIN_STATE,
                CourseStateMachines.MAIN_PUBLISHED,
                fromMonth)));
        series.put("firstRoundPassRate", alignRatio(months, mapper.firstRoundReviewPassByMonth(
                recordCompleted, REVIEW_RESULT_PASS, fromMonth)));
        series.put("casePublishCycle", alignAvg(months, mapper.casePublishCycleByMonth(
                casePublished, fromMonth)));
        // series 的 List 含 null（无样本月），不能用 Map.copyOf
        return new EfficiencyTrendsVO(months, Collections.unmodifiableMap(series));
    }

    private static List<String> lastSixMonthKeys() {
        YearMonth end = YearMonth.now();
        List<String> keys = new ArrayList<>(6);
        for (int i = 5; i >= 0; i--) {
            keys.add(end.minusMonths(i).toString());
        }
        return List.copyOf(keys);
    }

    private static List<String> alignAvg(List<String> months, List<Map<String, Object>> rows) {
        Map<String, BigDecimal> byMonth = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String key = stringOf(row, "monthKey", "MONTHKEY");
            if (key == null) {
                continue;
            }
            Number avg = numberOf(row, "avgDays", "AVGDAYS");
            if (avg != null) {
                byMonth.put(key, BigDecimal.valueOf(avg.doubleValue())
                        .setScale(1, RoundingMode.HALF_UP));
            }
        }
        List<String> out = new ArrayList<>(months.size());
        for (String m : months) {
            BigDecimal v = byMonth.get(m);
            // 无样本月为 null（前端「—」）；List.copyOf 禁止 null 元素
            out.add(v == null ? null : v.toPlainString());
        }
        return Collections.unmodifiableList(out);
    }

    private static List<String> alignRatio(List<String> months, List<Map<String, Object>> rows) {
        Map<String, BigDecimal> byMonth = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String key = stringOf(row, "monthKey", "MONTHKEY");
            if (key == null) {
                continue;
            }
            BigDecimal ratio = Ratio.of(asLong(row, "numerator", "NUMERATOR"),
                    asLong(row, "denominator", "DENOMINATOR"));
            if (ratio != null) {
                byMonth.put(key, ratio);
            }
        }
        List<String> out = new ArrayList<>(months.size());
        for (String m : months) {
            BigDecimal v = byMonth.get(m);
            out.add(v == null ? null : v.toPlainString());
        }
        return Collections.unmodifiableList(out);
    }

    private static String stringOf(Map<String, Object> row, String... keys) {
        if (row == null) {
            return null;
        }
        for (String key : keys) {
            Object v = row.get(key);
            if (v != null) {
                return v.toString();
            }
        }
        return null;
    }

    private static Number numberOf(Map<String, Object> row, String... keys) {
        if (row == null) {
            return null;
        }
        for (String key : keys) {
            Object v = row.get(key);
            if (v instanceof Number n) {
                return n;
            }
        }
        return null;
    }

    private static Map<String, BigDecimal> ratioByMonth(List<Map<String, Object>> rows) {
        Map<String, BigDecimal> byMonth = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String key = stringOf(row, "monthKey", "MONTHKEY");
            if (key == null) {
                continue;
            }
            BigDecimal ratio = Ratio.of(asLong(row, "numerator", "NUMERATOR"),
                    asLong(row, "denominator", "DENOMINATOR"));
            if (ratio != null) {
                byMonth.put(key, ratio);
            }
        }
        return byMonth;
    }

    private static String percentOf(BigDecimal rate) {
        return rate == null ? null : rate.toPlainString() + "%";
    }

    private static String momCount(long thisVal, long lastVal) {
        if (lastVal == 0L) {
            return null;
        }
        return formatMom(BigDecimal.valueOf(thisVal - lastVal)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(lastVal), 1, RoundingMode.HALF_UP));
    }

    private static String momRate(BigDecimal thisRate, BigDecimal lastRate) {
        if (thisRate == null || lastRate == null) {
            return null;
        }
        return formatMom(thisRate.subtract(lastRate).setScale(1, RoundingMode.HALF_UP));
    }

    private static String formatMom(BigDecimal delta) {
        String arrow = delta.signum() < 0 ? "↓" : "↑";
        return arrow + " " + delta.abs().toPlainString() + "%";
    }

    private static BigDecimal ratioOf(Map<String, Object> counts) {
        long num = asLong(counts, "numerator", "NUMERATOR");
        long den = asLong(counts, "denominator", "DENOMINATOR");
        return Ratio.of(num, den);
    }

    private static long asLong(Map<String, Object> row, String... keys) {
        if (row == null) {
            return 0L;
        }
        for (String key : keys) {
            Object v = row.get(key);
            if (v instanceof Number n) {
                return n.longValue();
            }
        }
        return 0L;
    }

    private static List<String> allStates(StateMachineDef def) {
        List<String> states = new ArrayList<>();
        for (Transition t : def.transitions()) {
            if (t.from() != null && !states.contains(t.from())) {
                states.add(t.from());
            }
            if (t.to() != null && !states.contains(t.to())) {
                states.add(t.to());
            }
        }
        return List.copyOf(states);
    }

    private static String toState(StateMachineDef def, String action) {
        return def.transitions().stream()
                .filter(t -> action.equals(t.action()))
                .map(Transition::to)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "状态机 " + def.machineName() + " 无动作 " + action));
    }
}
