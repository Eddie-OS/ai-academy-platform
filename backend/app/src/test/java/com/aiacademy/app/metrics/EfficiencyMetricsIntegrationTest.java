package com.aiacademy.app.metrics;

import com.aiacademy.aggregate.metrics.domain.CourseMonthlyOverviewVO;
import com.aiacademy.aggregate.metrics.domain.EfficiencySnapshot;
import com.aiacademy.aggregate.metrics.domain.EfficiencySummaryVO;
import com.aiacademy.aggregate.metrics.domain.Ratio;
import com.aiacademy.aggregate.metrics.repository.EfficiencyMetricsMapper;
import com.aiacademy.aggregate.metrics.service.EfficiencyMetricsService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 需求 15.2 效率类 9 项：含回退后再到达，断言周期取首次 MIN（E1）。
 */
class EfficiencyMetricsIntegrationTest extends IntegrationTest {

    @Autowired
    private EfficiencyMetricsService efficiency;

    @Autowired
    private EfficiencyMetricsMapper mapper;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void 运营账号() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.3.1");
    }

    @AfterEach
    void 清理() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("15.2 #1／#3：回退后再次到达仍取首次 MIN；summary 形态合法")
    void 回退后周期取首次() {
        String owner = 造人员();
        LocalDate proposed = LocalDate.now().minusDays(20);
        LocalDate initiated = LocalDate.now().minusDays(40);

        long demandId = jdbc.queryForObject("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state, created_by)
                VALUES (?, '效率-需求评审周期', 'COURSE', ?, ?, ?, CURRENT_DATE + 30,
                        '描述', '已评审', 'OPS')
                RETURNING id
                """, Long.class, "XQ" + nano(), owner, owner, proposed);

        写状态日志(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_REVIEW_STATE, "待评审", "已评审",
                proposed.plusDays(10).atStartOfDay().atOffset(ZoneOffset.ofHours(8)));
        写状态日志(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_REVIEW_STATE, "已评审", "评审中",
                proposed.plusDays(15).atStartOfDay().atOffset(ZoneOffset.ofHours(8)));
        写状态日志(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_REVIEW_STATE, "评审中", "已评审",
                proposed.plusDays(18).atStartOfDay().atOffset(ZoneOffset.ofHours(8)));

        long courseId = 造课程(owner, "发布", initiated);
        写状态日志(CourseStateMachines.OBJECT_TYPE, courseId,
                CourseStateMachines.FIELD_MAIN_STATE, "试讲", "发布",
                initiated.plusDays(12).atStartOfDay().atOffset(ZoneOffset.ofHours(8)));
        写状态日志(CourseStateMachines.OBJECT_TYPE, courseId,
                CourseStateMachines.FIELD_MAIN_STATE, "发布", "优化",
                initiated.plusDays(20).atStartOfDay().atOffset(ZoneOffset.ofHours(8)));
        写状态日志(CourseStateMachines.OBJECT_TYPE, courseId,
                CourseStateMachines.FIELD_MAIN_STATE, "优化", "发布",
                initiated.plusDays(30).atStartOfDay().atOffset(ZoneOffset.ofHours(8)));

        Integer demandDays = jdbc.queryForObject("""
                SELECT (MIN(l.changed_at)::DATE - d.proposed_date)
                  FROM biz_demand d
                  JOIN audit_state_log l
                    ON l.object_type = ? AND l.object_id = d.id
                   AND l.state_field = ? AND l.to_state = '已评审'
                 WHERE d.id = ?
                 GROUP BY d.id, d.proposed_date
                """, Integer.class,
                DemandStateMachines.OBJECT_TYPE,
                DemandStateMachines.FIELD_REVIEW_STATE,
                demandId);
        Integer courseDays = jdbc.queryForObject("""
                SELECT (MIN(l.changed_at)::DATE - c.initiated_date)
                  FROM biz_course c
                  JOIN audit_state_log l
                    ON l.object_type = ? AND l.object_id = c.id
                   AND l.state_field = ? AND l.to_state = ?
                 WHERE c.id = ?
                 GROUP BY c.id, c.initiated_date
                """, Integer.class,
                CourseStateMachines.OBJECT_TYPE,
                CourseStateMachines.FIELD_MAIN_STATE,
                CourseStateMachines.MAIN_PUBLISHED,
                courseId);

        assertThat(demandDays).isEqualTo(10);
        assertThat(courseDays).isEqualTo(12);

        List<Integer> demandCycles = mapper.demandReviewCycleDays(
                DemandStateMachines.OBJECT_TYPE,
                DemandStateMachines.FIELD_REVIEW_STATE,
                "已评审");
        List<Integer> courseCycles = mapper.courseDevCycleDays(
                CourseStateMachines.OBJECT_TYPE,
                CourseStateMachines.FIELD_MAIN_STATE,
                CourseStateMachines.MAIN_PUBLISHED);
        assertThat(demandCycles).contains(10);
        assertThat(courseCycles).contains(12);

        EfficiencySnapshot snap = efficiency.all();
        assertThat(snap.get("1")).isNotNull();
        assertThat(snap.get("3")).isNotNull();

        EfficiencySummaryVO summary = efficiency.summary();
        assertThat(summary.demandReviewCycle()).isNotNull();
        assertThat(summary.courseDevCycle()).isNotNull();
        assertThat(new BigDecimal(summary.demandReviewCycle()).scale()).isEqualTo(1);
        assertThat(new BigDecimal(summary.courseDevCycle()).scale()).isEqualTo(1);

        var trends = efficiency.trendsLast6Months();
        assertThat(trends.months()).hasSize(6);
        assertThat(trends.series().get("demandReviewCycle")).hasSize(6);
        // 首次到达在 proposed+10 日（约上月），按 15.2.3 归入该月而非「今天」所在月
        String hitMonth = proposed.plusDays(10).withDayOfMonth(1)
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM"));
        int idx = trends.months().indexOf(hitMonth);
        assertThat(idx).isGreaterThanOrEqualTo(0);
        assertThat(trends.series().get("demandReviewCycle").get(idx)).isEqualTo("10.0");
    }

    @Test
    @DisplayName("课程工作台本月概览：新建数为数字串，通过率带 % 或为空")
    void 本月概览形态() {
        CourseMonthlyOverviewVO vo = efficiency.courseMonthlyOverview();
        assertThat(vo.newCourses()).matches("\\d+");
        if (vo.reviewFirstPass() != null) {
            assertThat(vo.reviewFirstPass()).endsWith("%");
        }
        if (vo.trialFirstPass() != null) {
            assertThat(vo.trialFirstPass()).endsWith("%");
        }
    }

    @Test
    @DisplayName("15.2 #2／#4～#9：造数后 mapper／服务可算出对应贡献")
    void 其余七项造数() {
        String owner = 造人员();
        LocalDate proposed = LocalDate.now().minusDays(14);
        String completed = "已完成";
        String planCompleted = "已完成";

        Map<String, Object> reviewBefore = mapper.firstRoundReviewPassCounts(completed, "通过");
        Map<String, Object> trialBefore = mapper.firstRoundTrialPassCounts(completed, "合格");
        Map<String, Object> planBefore = mapper.planOnTimeCounts(planCompleted);
        List<Integer> deliveryBefore = mapper.demandDeliveryCycleDays(List.of("已交付", "已归档"));
        List<Integer> reviewRoundsBefore = mapper.courseCompletedReviewRounds(completed);
        List<Integer> trialRoundsBefore = mapper.courseCompletedTrialRounds(completed);
        List<Integer> caseBefore = mapper.casePublishCycleDays("已上架");

        jdbc.update("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state,
                    delivery_mark, delivered_at, created_by)
                VALUES (?, '效率-交付周期', 'COURSE', ?, ?, ?, CURRENT_DATE + 30,
                        '描述', '已评审', '已交付', ?, 'OPS')
                """, "XQ" + nano(), owner, owner, proposed, proposed.plusDays(7));

        long courseA = 造课程(owner, "发布", LocalDate.now().minusDays(30));
        long courseB = 造课程(owner, "发布", LocalDate.now().minusDays(30));
        jdbc.update("""
                INSERT INTO dtl_course_review (course_id, round_no, review_date, review_result,
                    record_state, created_by)
                VALUES (?, 1, CURRENT_DATE, '通过', '已完成', 'OPS')
                """, courseA);
        jdbc.update("""
                INSERT INTO dtl_course_review (course_id, round_no, review_date, review_result,
                    record_state, created_by)
                VALUES (?, 2, CURRENT_DATE, '通过', '已完成', 'OPS')
                """, courseA);
        jdbc.update("""
                INSERT INTO dtl_course_review (course_id, round_no, review_date, review_result,
                    record_state, created_by)
                VALUES (?, 1, CURRENT_DATE, '不通过·修改后重新评审', '已完成', 'OPS')
                """, courseB);

        String emp = 造人员();
        long lecturerId = 造讲师(emp);
        jdbc.update("""
                INSERT INTO dtl_course_trial (course_id, round_no, trial_date, lecturer_id,
                    course_conclusion, lecturer_conclusion, record_state, created_by)
                VALUES (?, 1, CURRENT_DATE, ?, '合格', '合格', '已完成', 'OPS')
                """, courseA, lecturerId);
        jdbc.update("""
                INSERT INTO dtl_course_trial (course_id, round_no, trial_date, lecturer_id,
                    course_conclusion, lecturer_conclusion, record_state, created_by)
                VALUES (?, 1, CURRENT_DATE, ?, '不合格', '合格', '已完成', 'OPS')
                """, courseB, lecturerId);

        long caseCourse = 造课程(owner, "精品案例", LocalDate.now().minusDays(60));
        OffsetDateTime created = OffsetDateTime.now().minusDays(9);
        OffsetDateTime published = OffsetDateTime.now().minusDays(2);
        jdbc.update("""
                INSERT INTO biz_case (case_no, case_name, course_id, contributing_org, contributors,
                    domain_codes, owner_no, case_state, published_at, expect_publish_date,
                    created_at, created_by)
                VALUES (?, '效率-上架周期', ?, '某部门', '[]'::jsonb, '["COURSE"]'::jsonb, ?,
                        '已上架', ?, CURRENT_DATE, ?, 'OPS')
                """, "AL" + nano(), caseCourse, owner, published, created);

        jdbc.update("""
                INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                    plan_start_date, plan_end_date, plan_state, actual_finish_date, created_by)
                VALUES (?, '效率-按时', ?, ?, '全体', CURRENT_DATE - 10, CURRENT_DATE,
                        '已完成', CURRENT_DATE - 1, 'OPS')
                """, "JH" + nano(), courseA, owner);
        jdbc.update("""
                INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                    plan_start_date, plan_end_date, plan_state, actual_finish_date, created_by)
                VALUES (?, '效率-逾期', ?, ?, '全体', CURRENT_DATE - 20, CURRENT_DATE - 10,
                        '已完成', CURRENT_DATE - 5, 'OPS')
                """, "JH" + nano(), courseB, owner);

        List<Integer> deliveryAfter = mapper.demandDeliveryCycleDays(List.of("已交付", "已归档"));
        assertThat(deliveryAfter).hasSizeGreaterThan(deliveryBefore.size());
        assertThat(deliveryAfter).contains(7);

        List<Integer> reviewRoundsAfter = mapper.courseCompletedReviewRounds(completed);
        assertThat(reviewRoundsAfter).contains(2, 1);
        assertThat(reviewRoundsAfter.size()).isGreaterThanOrEqualTo(reviewRoundsBefore.size() + 2);

        Map<String, Object> reviewAfter = mapper.firstRoundReviewPassCounts(completed, "通过");
        assertThat(asLong(reviewAfter, "numerator"))
                .isEqualTo(asLong(reviewBefore, "numerator") + 1);
        assertThat(asLong(reviewAfter, "denominator"))
                .isEqualTo(asLong(reviewBefore, "denominator") + 2);

        List<Integer> trialRoundsAfter = mapper.courseCompletedTrialRounds(completed);
        assertThat(trialRoundsAfter.size()).isGreaterThanOrEqualTo(trialRoundsBefore.size() + 2);

        Map<String, Object> trialAfter = mapper.firstRoundTrialPassCounts(completed, "合格");
        assertThat(asLong(trialAfter, "numerator"))
                .isEqualTo(asLong(trialBefore, "numerator") + 1);
        assertThat(asLong(trialAfter, "denominator"))
                .isEqualTo(asLong(trialBefore, "denominator") + 2);

        List<Integer> caseAfter = mapper.casePublishCycleDays("已上架");
        assertThat(caseAfter).contains(7);
        assertThat(caseAfter.size()).isGreaterThan(caseBefore.size());

        Map<String, Object> planAfter = mapper.planOnTimeCounts(planCompleted);
        assertThat(asLong(planAfter, "numerator"))
                .isEqualTo(asLong(planBefore, "numerator") + 1);
        assertThat(asLong(planAfter, "denominator"))
                .isEqualTo(asLong(planBefore, "denominator") + 2);

        // 服务层经 Average／Ratio 包装不抛异常，且增量后比率可算
        EfficiencySnapshot snap = efficiency.all();
        assertThat(snap.get("2")).isNotNull();
        assertThat(snap.get("4")).isNotNull();
        assertThat(snap.get("5")).isEqualByComparingTo(Ratio.of(
                asLong(reviewAfter, "numerator"), asLong(reviewAfter, "denominator")));
        assertThat(snap.get("6")).isNotNull();
        assertThat(snap.get("7")).isEqualByComparingTo(Ratio.of(
                asLong(trialAfter, "numerator"), asLong(trialAfter, "denominator")));
        assertThat(snap.get("8")).isNotNull();
        assertThat(snap.get("9")).isEqualByComparingTo(Ratio.of(
                asLong(planAfter, "numerator"), asLong(planAfter, "denominator")));

        // 状态字面量从状态机取，避免测试里漂移
        assertThat(CourseRecordStateMachines.review().transitions().stream()
                .anyMatch(t -> completed.equals(t.to()))).isTrue();
        assertThat(TrainingStateMachines.plan().transitions().stream()
                .anyMatch(t -> planCompleted.equals(t.to()))).isTrue();
    }

    private static long asLong(Map<String, Object> row, String key) {
        Object v = row.get(key);
        if (v == null) {
            v = row.get(key.toUpperCase());
        }
        return v instanceof Number n ? n.longValue() : 0L;
    }

    private void 写状态日志(String objectType, long objectId, String stateField,
                           String from, String to, OffsetDateTime at) {
        jdbc.update("""
                INSERT INTO audit_state_log (object_type, object_id, state_field, from_state, to_state,
                    action_code, account_type, changed_at)
                VALUES (?, ?, ?, ?, ?, 'TEST', 'OPS', ?)
                """, objectType, objectId, stateField, from, to, at);
    }

    private String 造人员() {
        String no = "E" + nano();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, 'AI中心', '两者', '在职', 'OPS')
                """, no, "效率人员" + no);
        return no;
    }

    private long 造课程(String ownerNo, String mainState, LocalDate initiated) {
        return jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                    initiated_date, expect_publish_date, validity_period, initiation_no,
                    main_state, created_by)
                VALUES (?, ?, '内部端到端课程', 'COURSE', ?, ?, CURRENT_DATE + 30,
                        '长期有效', ?, ?, 'OPS')
                RETURNING id
                """, Long.class, "KC" + nano(), "效率课-" + nano(), ownerNo, initiated,
                "LI" + nano(), mainState);
    }

    private long 造讲师(String employeeNo) {
        return jdbc.queryForObject("""
                INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                    expertise_domains, teaching_direction, join_type, joined_date,
                    training_state, trial_qualified, pool_state, created_by)
                VALUES (?, ?, ?, 'AI中心', '["课程"]'::jsonb, '方向', '运营手动添加',
                        CURRENT_DATE, '可上岗', TRUE, '在池', 'OPS')
                RETURNING id
                """, Long.class, "JS" + nano(), "讲师" + employeeNo, employeeNo);
    }

    private static long nano() {
        return System.nanoTime() % 1_000_000_000L;
    }
}
