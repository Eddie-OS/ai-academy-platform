package com.aiacademy.app.metrics;

import com.aiacademy.aggregate.metrics.domain.CockpitQuantityVO;
import com.aiacademy.aggregate.metrics.domain.InteractionMetricsSnapshot;
import com.aiacademy.aggregate.metrics.domain.LecturerMetricsSnapshot;
import com.aiacademy.aggregate.metrics.service.InteractionMetricsService;
import com.aiacademy.aggregate.metrics.service.LecturerMetricsService;
import com.aiacademy.aggregate.metrics.service.QuantityMetricsService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 需求 15.3／15.5：驾驶舱 key + R10 正式／试讲评分分离 + 互动全库计数。
 */
class LecturerInteractionMetricsIntegrationTest extends IntegrationTest {

    @Autowired
    private QuantityMetricsService quantity;

    @Autowired
    private LecturerMetricsService lecturerMetrics;

    @Autowired
    private InteractionMetricsService interactionMetrics;

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
    @DisplayName("15.3 #5／#7 与驾驶舱 attendees／active；#3 不含试讲反馈（R10）")
    void 讲师授课与评分隔离() {
        String owner = 造人员();
        long courseId = 造课程(owner);
        String emp = 造人员();
        long lecturerId = 造讲师(emp);

        long planId = jdbc.queryForObject("""
                INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                    plan_start_date, plan_end_date, plan_state, created_by)
                VALUES (?, '讲师指标计划', ?, ?, '全体', CURRENT_DATE, CURRENT_DATE + 5, '执行中', 'OPS')
                RETURNING id
                """, Long.class, "JH" + nano(), courseId, owner);

        long sessionId = jdbc.queryForObject("""
                INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id, lecturer_id,
                    training_date, start_time, end_time, training_form, student_scope, session_state, created_by)
                VALUES (?, ?, '结束场', ?, ?, CURRENT_DATE, '09:00', '12:00', '线下', '全体', ?, 'OPS')
                RETURNING id
                """, Long.class, "CC" + nano(), planId, courseId, lecturerId,
                TrainingStateMachines.SESSION_FINISHED);

        jdbc.update("""
                INSERT INTO dtl_attendance (session_id, employee_no, employee_name_snapshot, attend_status, created_by)
                VALUES (?, ?, '学员', '已签到', 'OPS')
                """, sessionId, 造人员());
        jdbc.update("""
                INSERT INTO dtl_training_feedback (session_id, submitter_name, score, import_batch_no, created_by)
                VALUES (?, '学员', 5, ?, 'OPS')
                """, sessionId, "B" + nano());

        long trialId = jdbc.queryForObject("""
                INSERT INTO dtl_course_trial (course_id, round_no, trial_date, lecturer_id,
                    record_state, created_by)
                VALUES (?, 1, CURRENT_DATE, ?, '已完成', 'OPS')
                RETURNING id
                """, Long.class, courseId, lecturerId);
        jdbc.update("""
                INSERT INTO dtl_trial_feedback (trial_id, submitter_name, score, import_batch_no, created_by)
                VALUES (?, '专家', 1, ?, 'OPS')
                """, trialId, "TB" + nano());

        LecturerMetricsSnapshot beforeGlobal = lecturerMetrics.all();
        CockpitQuantityVO lectVo = quantity.forLecturers();
        assertThat(lectVo.values()).containsKeys("pool", "qualified", "attendees", "active");
        assertThat(lectVo.values().get("attendees")).isGreaterThanOrEqualTo(1L);
        assertThat(lectVo.values().get("active")).isGreaterThanOrEqualTo(1L);

        assertThat(lecturerMetrics.teachingCount(lecturerId)).isGreaterThanOrEqualTo(1L);
        assertThat(lecturerMetrics.attendeeSum(lecturerId)).isGreaterThanOrEqualTo(1L);
        // R10：正式 5 分，试讲 1 分 → 讲师均分仍为 5.0
        assertThat(lecturerMetrics.avgScore(lecturerId)).isEqualByComparingTo("5.0");
        assertThat(lecturerMetrics.avgTrialFeedback(trialId)).isEqualByComparingTo("1.0");
        assertThat(lecturerMetrics.avgScoreForSession(lecturerId, sessionId)).isEqualByComparingTo("5.0");

        LecturerMetricsSnapshot after = lecturerMetrics.all();
        assertThat(after.teachingSessionsThisMonth())
                .isGreaterThanOrEqualTo(beforeGlobal.teachingSessionsThisMonth());
        assertThat(after.avgGlobalScore()).isNotNull();
    }

    @Test
    @DisplayName("15.5 #1～#3／#5～#7：互动计数与驾驶舱三卡")
    void 案例互动() {
        String owner = 造人员();
        long courseId = 造课程(owner);
        long caseId = jdbc.queryForObject("""
                INSERT INTO biz_case (case_no, case_name, course_id, contributing_org, contributors,
                    domain_codes, owner_no, case_state, published_at, expect_publish_date, created_by)
                VALUES (?, '互动案例', ?, '某部门', '[]'::jsonb, '["COURSE"]'::jsonb, ?,
                        '已上架', NOW(), CURRENT_DATE, 'OPS')
                RETURNING id
                """, Long.class, "AL" + nano(), courseId, owner);

        jdbc.update("""
                INSERT INTO dtl_case_view (case_id, account_type, source_ip, duration_seconds)
                VALUES (?, 'OPS', '10.0.0.1', 100)
                """, caseId);
        jdbc.update("""
                INSERT INTO dtl_case_view (case_id, account_type, source_ip, duration_seconds)
                VALUES (?, 'OPS', '10.0.0.1', 4000)
                """, caseId); // 封顶 1800
        jdbc.update("""
                INSERT INTO dtl_case_like (case_id, account_type, source_ip)
                VALUES (?, 'USER', '10.0.0.2')
                """, caseId);
        jdbc.update("""
                INSERT INTO dtl_case_comment (case_id, content, account_type, created_by)
                VALUES (?, '好案例', 'USER', 'OPS')
                """, caseId);

        CockpitQuantityVO casesVo = quantity.forCases();
        assertThat(casesVo.values()).containsKeys("total", "published", "views", "likes", "comments");
        assertThat(casesVo.values().get("views")).isGreaterThanOrEqualTo(2L);
        assertThat(casesVo.values().get("likes")).isGreaterThanOrEqualTo(1L);
        assertThat(casesVo.values().get("comments")).isGreaterThanOrEqualTo(1L);

        assertThat(interactionMetrics.views(caseId)).isEqualTo(2L);
        assertThat(interactionMetrics.likes(caseId)).isEqualTo(1L);
        assertThat(interactionMetrics.comments(caseId)).isEqualTo(1L);

        InteractionMetricsSnapshot snap = interactionMetrics.all();
        assertThat(snap.views()).isGreaterThanOrEqualTo(2L);
        assertThat(snap.activeCases30d()).isGreaterThanOrEqualTo(1L);
        assertThat(snap.publishedInRange()).isGreaterThanOrEqualTo(1L);
        // (100 + 1800) / 2 = 950.0（全局均值受库内其他浏览影响，只断言本案例路径非空）
        assertThat(snap.avgReadDurationSeconds()).isNotNull();
        assertThat(snap.avgReadDurationSeconds()).isInstanceOf(BigDecimal.class);
    }

    private String 造人员() {
        String no = "E" + nano();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, 'AI中心', '两者', '在职', 'OPS')
                """, no, "互动人员" + no);
        return no;
    }

    private long 造课程(String ownerNo) {
        return jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                    initiated_date, expect_publish_date, validity_period, initiation_no,
                    main_state, created_by)
                VALUES (?, ?, '内部端到端课程', 'COURSE', ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '长期有效', ?, '发布', 'OPS')
                RETURNING id
                """, Long.class, "KC" + nano(), "互动课-" + nano(), ownerNo, "LI" + nano());
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
