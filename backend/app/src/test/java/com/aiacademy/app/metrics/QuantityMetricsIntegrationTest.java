package com.aiacademy.app.metrics;

import com.aiacademy.aggregate.metrics.domain.CockpitQuantityVO;
import com.aiacademy.aggregate.metrics.domain.QuantitySnapshot;
import com.aiacademy.aggregate.metrics.service.QuantityMetricsService;
import com.aiacademy.aggregate.warning.domain.LightColor;
import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.app.web.WarningLightAssembler;
import com.aiacademy.app.web.dto.DemandVO;
import com.aiacademy.business.demand.domain.DemandListItem;
import com.aiacademy.business.demand.domain.DemandQuery;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.DayOfWeek;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 需求 15.1 数量类 28 项：构造数据 → COUNT 期望（E3-1 自动化半边）。
 */
class QuantityMetricsIntegrationTest extends IntegrationTest {

    @Autowired
    private QuantityMetricsService quantity;

    @Autowired
    private DemandService demands;

    @Autowired
    private WarningLightAssembler warningLights;

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
    @DisplayName("15.1 共 28 项：造数后对应 COUNT 各至少 +1")
    void 二十八项构造数据() {
        QuantitySnapshot before = quantity.all();
        String owner = 造人员();
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = today.with(DayOfWeek.SUNDAY);

        // ---- 需求 #1～#5b ----
        jdbc.update("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state, created_by)
                VALUES (?, '数量指标-待评审', 'COURSE', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '描述', '待评审', 'OPS')
                """, "XQ" + nano(), owner, owner);

        jdbc.update("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state, outlet, dev_state,
                    created_by)
                VALUES (?, '数量指标-开发中', 'COURSE', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '描述', '已评审', '造工具需求开发', '开发中', 'OPS')
                """, "XQ" + nano(), owner, owner);

        jdbc.update("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state, outlet,
                    solution_state, created_by)
                VALUES (?, '数量指标-出口一', 'COURSE', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '描述', '已评审', '用现有工具输出解决方案', '已输出', 'OPS')
                """, "XQ" + nano(), owner, owner);

        jdbc.update("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state,
                    delivery_mark, acceptance_state, created_by)
                VALUES (?, '数量指标-已交付待验收', 'COURSE', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '描述', '已评审', '已交付', '待验收', 'OPS')
                """, "XQ" + nano(), owner, owner);

        jdbc.update("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state,
                    delivery_mark, acceptance_state, created_by)
                VALUES (?, '数量指标-验收不通过', 'COURSE', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '描述', '已评审', '已交付', '验收不通过', 'OPS')
                """, "XQ" + nano(), owner, owner);

        // ---- 课程 #6～#10b ----
        long courseDev = 造课程(owner, "开发", null);
        long coursePub = 造课程(owner, "发布", null);
        long courseQuality = 造课程(owner, "精品案例", null);
        造课程(owner, "已关闭", null);
        造课程(owner, "发布", today.minusDays(1)); // 已过期
        造课程(owner, "发布", today.plusDays(10)); // 30 天内到期

        // ---- 讲师 #11～#12b ----
        String emp1 = 造人员();
        造讲师(emp1, "待培养", false);
        String emp2 = 造人员();
        造讲师(emp2, "可上岗", true);
        String emp3 = 造人员();
        造讲师(emp3, "培养中", false);

        // ---- 培训 #13～#16b ----
        long planId = jdbc.queryForObject("""
                INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                    plan_start_date, plan_end_date, plan_state, created_by)
                VALUES (?, '数量指标计划', ?, ?, '全体', ?, ?, '执行中', 'OPS')
                RETURNING id
                """, Long.class, "JH" + (nano() % 1_000_000_000L), coursePub, owner,
                monthStart, today.plusDays(5));
        // 本周计划：区间与本周重叠
        jdbc.update("""
                INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                    plan_start_date, plan_end_date, plan_state, created_by)
                VALUES (?, '本周计划', ?, ?, '全体', ?, ?, '待执行', 'OPS')
                """, "JH" + (nano() % 1_000_000_000L), coursePub, owner, weekStart, weekEnd);

        long lecturerId = jdbc.queryForObject(
                "SELECT id FROM biz_lecturer WHERE employee_no = ?", Long.class, emp2);
        long sessionOpened = jdbc.queryForObject("""
                INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id, lecturer_id,
                    training_date, start_time, end_time, training_form, student_scope, session_state, created_by)
                VALUES (?, ?, '进行中场', ?, ?, ?, '09:00', '12:00', '线下', '全体', ?, 'OPS')
                RETURNING id
                """, Long.class, "CC" + nano(), planId, coursePub, lecturerId, today,
                TrainingStateMachines.SESSION_OPENED);
        long sessionMonth = jdbc.queryForObject("""
                INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id, lecturer_id,
                    training_date, start_time, end_time, training_form, student_scope, session_state, created_by)
                VALUES (?, ?, '本月场', ?, ?, ?, '09:00', '12:00', '线下', '全体', '待开课', 'OPS')
                RETURNING id
                """, Long.class, "CC" + nano(), planId, coursePub, lecturerId, today);

        String attendee = 造人员();
        jdbc.update("""
                INSERT INTO dtl_attendance (session_id, employee_no, employee_name_snapshot, attend_status, created_by)
                VALUES (?, ?, '学员甲', '已签到', 'OPS')
                """, sessionMonth, attendee);
        jdbc.update("""
                INSERT INTO dtl_attendance (session_id, employee_no, employee_name_snapshot, attend_status, created_by)
                VALUES (?, ?, '学员甲', '已签到', 'OPS')
                """, sessionOpened, attendee);

        jdbc.update("""
                INSERT INTO sys_task (title, task_type, object_type, object_id, due_date,
                    task_state, derive_type, created_by)
                VALUES ('待导入签到', '签到导入', 'TRAINING_SESSION', ?, CURRENT_DATE + 3, ?, '系统派生', 'OPS')
                """, sessionOpened, TaskStateMachine.STATE_PENDING);
        jdbc.update("""
                INSERT INTO sys_task (title, task_type, object_type, object_id, due_date,
                    task_state, derive_type, created_by)
                VALUES ('待归档', '培训归档', 'TRAINING_SESSION', ?, CURRENT_DATE + 7, ?, '系统派生', 'OPS')
                """, sessionOpened, TaskStateMachine.STATE_PENDING);

        // ---- 案例 #17～#19（案例与课程 1:1，各占一门精品课程）----
        long courseForCase2 = 造课程(owner, "精品案例", null);
        jdbc.update("""
                INSERT INTO biz_case (case_no, case_name, course_id, contributing_org, contributors,
                    domain_codes, owner_no, case_state, quality_marks, expect_publish_date, created_by)
                VALUES (?, '数量指标案例-待审核', ?, '某部门', '[]'::jsonb, '["COURSE"]'::jsonb, ?,
                        '待审核', '["精品"]'::jsonb, CURRENT_DATE + 7, 'OPS')
                """, "AL" + nano(), courseQuality, owner);
        jdbc.update("""
                INSERT INTO biz_case (case_no, case_name, course_id, contributing_org, contributors,
                    domain_codes, owner_no, case_state, quality_marks, published_at, created_by)
                VALUES (?, '数量指标案例-已上架', ?, '某部门', '[]'::jsonb, '["COURSE"]'::jsonb, ?,
                        '已上架', '["推荐"]'::jsonb, NOW(), 'OPS')
                """, "AL" + nano(), courseForCase2, owner);

        QuantitySnapshot after = quantity.all();

        assertThat(after.asLong("1")).isGreaterThanOrEqualTo(before.asLong("1") + 5);
        assertThat(after.asGroup("2").getOrDefault("待评审", 0L))
                .isGreaterThanOrEqualTo(before.asGroup("2").getOrDefault("待评审", 0L) + 1);
        assertThat(after.asGroup("3").getOrDefault("开发中", 0L))
                .isGreaterThanOrEqualTo(before.asGroup("3").getOrDefault("开发中", 0L) + 1);
        assertThat(after.asGroup("4").getOrDefault("造工具需求开发", 0L))
                .isGreaterThanOrEqualTo(before.asGroup("4").getOrDefault("造工具需求开发", 0L) + 1);
        assertThat(after.asGroup("4").getOrDefault("用现有工具输出解决方案", 0L))
                .isGreaterThanOrEqualTo(before.asGroup("4").getOrDefault("用现有工具输出解决方案", 0L) + 1);
        assertThat(after.asLong("5")).isGreaterThanOrEqualTo(before.asLong("5") + 2);
        assertThat(after.asLong("5a")).isGreaterThanOrEqualTo(before.asLong("5a") + 1);
        assertThat(after.asLong("5b")).isGreaterThanOrEqualTo(before.asLong("5b") + 1);

        assertThat(after.asLong("6")).isGreaterThanOrEqualTo(before.asLong("6") + 5); // 不含已关闭
        assertThat(after.asLong("7")).isGreaterThanOrEqualTo(before.asLong("7") + 1);
        assertThat(after.asLong("8")).isGreaterThanOrEqualTo(before.asLong("8") + 4);
        assertThat(after.asLong("9")).isGreaterThanOrEqualTo(before.asLong("9") + 1);
        assertThat(after.asLong("10")).isGreaterThanOrEqualTo(before.asLong("10") + 1);
        assertThat(after.asLong("10a")).isGreaterThanOrEqualTo(before.asLong("10a") + 1);
        assertThat(after.asLong("10b")).isGreaterThanOrEqualTo(before.asLong("10b") + 1);

        assertThat(after.asLong("11")).isGreaterThanOrEqualTo(before.asLong("11") + 3);
        assertThat(after.asLong("12")).isGreaterThanOrEqualTo(before.asLong("12") + 1);
        assertThat(after.asLong("12a")).isGreaterThanOrEqualTo(before.asLong("12a") + 1);
        assertThat(after.asGroup("12b").getOrDefault("待培养", 0L))
                .isGreaterThanOrEqualTo(before.asGroup("12b").getOrDefault("待培养", 0L) + 1);
        assertThat(after.asGroup("12b").getOrDefault("培养中", 0L))
                .isGreaterThanOrEqualTo(before.asGroup("12b").getOrDefault("培养中", 0L) + 1);
        assertThat(after.asGroup("12b").getOrDefault("可上岗", 0L))
                .isGreaterThanOrEqualTo(before.asGroup("12b").getOrDefault("可上岗", 0L) + 1);

        assertThat(after.asLong("13")).isGreaterThanOrEqualTo(before.asLong("13") + 1);
        assertThat(after.asLong("14")).isGreaterThanOrEqualTo(before.asLong("14") + 1);
        assertThat(after.asLong("15")).isGreaterThanOrEqualTo(before.asLong("15") + 2);
        assertThat(after.asLong("16")).isGreaterThanOrEqualTo(before.asLong("16") + 2);
        assertThat(after.asLong("16a")).isGreaterThanOrEqualTo(before.asLong("16a") + 2);
        assertThat(after.asLong("16b")).isGreaterThanOrEqualTo(before.asLong("16b") + 1);

        assertThat(after.asLong("17")).isGreaterThanOrEqualTo(before.asLong("17") + 2);
        assertThat(after.asLong("18")).isGreaterThanOrEqualTo(before.asLong("18") + 1);
        assertThat(after.asLong("18a")).isGreaterThanOrEqualTo(before.asLong("18a") + 1);
        assertThat(after.asLong("19")).isGreaterThanOrEqualTo(before.asLong("19") + 1);

        // 驾驶舱 scope 卡
        CockpitQuantityVO demandsVo = quantity.forDemands();
        assertThat(demandsVo.values()).containsKeys("total", "pending", "developing");
        assertThat(demandsVo.values()).doesNotContainKey("cycle");

        CockpitQuantityVO coursesVo = quantity.forCourses();
        assertThat(coursesVo.values()).containsKeys(
                "total", "developing", "reviewing", "pendingTrial", "published", "quality");
        /* 工作台五张卡与列表同一主状态：开发／评审决策／试讲／发布各数该值，总数含终态 */
        assertThat(coursesVo.values().get("developing")).isEqualTo(countCoursesByMainState("开发"));
        assertThat(coursesVo.values().get("reviewing")).isEqualTo(countCoursesByMainState("评审决策"));
        assertThat(coursesVo.values().get("pendingTrial")).isEqualTo(countCoursesByMainState("试讲"));
        assertThat(coursesVo.values().get("published")).isEqualTo(countCoursesByMainState("发布"));
        assertThat(coursesVo.values().get("total")).isEqualTo(countCoursesAll());
        /* 总看板课程卡的三数（业务改版 V-70）。断言的是漏斗单调性而不是具体值：
           已开发／已评审是「已经走过那一段」的累计口径，被包含关系一旦反过来
           （比如把「优化」漏出已开发），卡上三个数并排读就自相矛盾了 */
        assertThat(coursesVo.values()).containsKeys("developed", "reviewed");
        assertThat(coursesVo.values().get("developed"))
                .isGreaterThanOrEqualTo(coursesVo.values().get("reviewed"));
        assertThat(coursesVo.values().get("reviewed"))
                .isGreaterThanOrEqualTo(coursesVo.values().get("published"));

        // 本月结束态场次（15.3 #5 口径：COUNT 场次，非签到）
        jdbc.update("""
                INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id, lecturer_id,
                    training_date, start_time, end_time, training_form, student_scope, session_state, created_by)
                VALUES (?, ?, '结束场-数量', ?, ?, ?, '09:00', '12:00', '线下', '全体', ?, 'OPS')
                """, "CC" + nano(), planId, coursePub, lecturerId, today,
                TrainingStateMachines.SESSION_FINISHED);

        CockpitQuantityVO lecturersVo = quantity.forLecturers();
        assertThat(lecturersVo.values()).containsKeys("pool", "qualified", "attendees", "active");
        assertThat(lecturersVo.values().get("attendees")).isGreaterThanOrEqualTo(1L);
        assertThat(lecturersVo.values().get("active")).isGreaterThanOrEqualTo(1L);
        // 总看板讲师卡的三数（业务改版 V-70）。pendingTrial 数课程，cultivating 数讲师
        assertThat(lecturersVo.values()).containsKeys("pendingTrial", "cultivating");
        assertThat(lecturersVo.values().get("cultivating")).isGreaterThanOrEqualTo(1L);

        CockpitQuantityVO trainingsVo = quantity.forTrainings();
        assertThat(trainingsVo.values())
                .containsKeys("plans", "weekPlans", "sessions", "attendees", "attendance", "archive");
        assertThat(trainingsVo.values().get("weekPlans")).isGreaterThanOrEqualTo(1L);
        assertThat(trainingsVo.values().get("attendance")).isGreaterThanOrEqualTo(1L);
        assertThat(trainingsVo.values().get("archive")).isGreaterThanOrEqualTo(1L);

        long casePublishedId = jdbc.queryForObject(
                "SELECT id FROM biz_case WHERE case_name = '数量指标案例-已上架' ORDER BY id DESC LIMIT 1",
                Long.class);
        jdbc.update("""
                INSERT INTO dtl_case_view (case_id, account_type, source_ip, duration_seconds)
                VALUES (?, 'OPS', '127.0.0.1', 30)
                """, casePublishedId);
        jdbc.update("""
                INSERT INTO dtl_case_like (case_id, account_type, source_ip)
                VALUES (?, 'USER', '127.0.0.1')
                """, casePublishedId);
        jdbc.update("""
                INSERT INTO dtl_case_comment (case_id, content, account_type, created_by)
                VALUES (?, '赞', 'USER', 'OPS')
                """, casePublishedId);

        CockpitQuantityVO casesVo = quantity.forCases();
        assertThat(casesVo.values()).containsKeys("total", "published", "views", "likes", "comments");
        assertThat(casesVo.values().get("views")).isGreaterThanOrEqualTo(1L);
        assertThat(casesVo.values().get("likes")).isGreaterThanOrEqualTo(1L);
        assertThat(casesVo.values().get("comments")).isGreaterThanOrEqualTo(1L);

        // 避免未用告警
        assertThat(courseDev).isPositive();
        assertThat(sessionOpened).isPositive();
    }

    @Test
    @DisplayName("列表 VO 带 light=RED：红灯需求行可装配")
    void 列表行带红灯字段() {
        String owner = 造人员();
        long id = jdbc.queryForObject("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state,
                    last_state_changed_at, created_by)
                VALUES (?, '红灯列表行', 'COURSE', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '描述', '待评审', NOW() - INTERVAL '10 days', 'OPS')
                RETURNING id
                """, Long.class, "XQ" + nano(), owner, owner);

        WarningLightView view = warningLights.one(DemandStateMachines.OBJECT_TYPE, id);
        assertThat(view.light()).isEqualTo(LightColor.RED.apiCode());

        DemandQuery query = new DemandQuery();
        query.setLight(LightColor.RED.apiCode());
        query.setPageSize(200);
        DemandListItem row = demands.page(query).records().stream()
                .filter(r -> r.getId().equals(id))
                .findFirst()
                .orElseThrow();
        DemandVO vo = DemandVO.of(row, view);
        assertThat(vo.light()).isEqualTo("RED");
        assertThat(vo.lightDays()).isNotNull().isGreaterThanOrEqualTo(5);
        assertThat(vo.lightReason()).isEqualTo("状态停滞");
    }

    private String 造人员() {
        String no = "E" + nano();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, 'AI中心', '两者', '在职', 'OPS')
                """, no, "指标人员" + no);
        return no;
    }

    private long 造课程(String ownerNo, String mainState, LocalDate validityEnd) {
        return jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                    initiated_date, expect_publish_date, validity_period, validity_end_date,
                    initiation_no, main_state, created_by)
                VALUES (?, ?, '内部端到端课程', 'COURSE', ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '长期有效', ?, ?, ?, 'OPS')
                RETURNING id
                """, Long.class, "KC" + nano(), "课程-" + mainState + "-" + nano(), ownerNo,
                validityEnd, "LI" + nano(), mainState);
    }

    private long 造讲师(String employeeNo, String trainingState, boolean trialQualified) {
        return jdbc.queryForObject("""
                INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                    expertise_domains, teaching_direction, join_type, joined_date,
                    training_state, trial_qualified, pool_state, created_by)
                VALUES (?, ?, ?, 'AI中心', '["课程"]'::jsonb, '方向', '运营手动添加',
                        CURRENT_DATE, ?, ?, '在池', 'OPS')
                RETURNING id
                """, Long.class, "JS" + nano(), "讲师" + employeeNo, employeeNo,
                trainingState, trialQualified);
    }

    private long countCoursesByMainState(String mainState) {
        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM biz_course WHERE deleted = FALSE AND main_state = ?",
                Long.class, mainState);
        return count == null ? 0L : count;
    }

    private long countCoursesAll() {
        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM biz_course WHERE deleted = FALSE", Long.class);
        return count == null ? 0L : count;
    }

    private static long nano() {
        return System.nanoTime() % 1_000_000_000L;
    }
}
