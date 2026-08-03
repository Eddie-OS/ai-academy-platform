package com.aiacademy.app.worklist;

import com.aiacademy.aggregate.worklist.domain.TaskQuery;
import com.aiacademy.aggregate.worklist.service.TaskQueryService;
import com.aiacademy.app.application.CourseApplicationService;
import com.aiacademy.app.application.CourseReviewApplicationService;
import com.aiacademy.app.application.DemandApplicationService;
import com.aiacademy.app.application.TrainingApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.course.domain.CourseReviewForm;
import com.aiacademy.business.course.service.CourseReviewService;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandReviewForm;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.business.kase.service.CaseService;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.business.training.domain.TrainingPlanForm;
import com.aiacademy.business.training.domain.TrainingSessionForm;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 出口准则 E3-3：10 条 DERIVE_TASK 各触发一次；课程开发截止日取预计发布日；
 * CLOSE_RELATED_TASKS 关闭未完成任务；E3-5 按负责人筛选。
 */
class TaskDeriveIntegrationTest extends IntegrationTest {

    @Autowired
    private DemandApplicationService demands;

    @Autowired
    private DemandService demandService;

    @Autowired
    private CourseApplicationService courses;

    @Autowired
    private CourseReviewApplicationService reviewApplication;

    @Autowired
    private CourseReviewService reviews;

    @Autowired
    private TrainingApplicationService training;

    @Autowired
    private CaseService cases;

    @Autowired
    private TransitionApplicationService transitions;

    @Autowired
    private TaskQueryService taskQuery;

    @Autowired
    private JdbcTemplate jdbc;

    private String ownerNo;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.3.3");
        ownerNo = 造人员("任务负责人");
    }

    @AfterEach
    void 清理() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("E3-3：10 类 DERIVE_TASK 各落库一条；课程开发 due_date = expect_publish_date")
    void 十条派生规则各触发一次() {
        LocalDate expectPublish = LocalDate.now().plusDays(45);

        // 1 需求评审
        long demandId = demands.register(需求表单("派生-需求评审"));
        assertTask("需求评审", DemandStateMachines.OBJECT_TYPE, demandId);

        // 9 业务验收（标记交付）
        走到已发布解决方案(demandId);
        demands.markDelivered(demandId, demandService.get(demandId).getVersion());
        assertTask("业务验收", DemandStateMachines.OBJECT_TYPE, demandId);

        // 2 课程开发
        long courseId = courses.initiate(课程表单("派生-课程开发", expectPublish));
        Map<String, Object> devTask = assertTask("课程开发", CourseStateMachines.OBJECT_TYPE, courseId);
        assertThat(((java.sql.Date) devTask.get("due_date")).toLocalDate())
                .describedAs("13.1.2 第 2 条：截止取预计发布时间本身，不是立项日+N")
                .isEqualTo(expectPublish);

        // 3 课程评审
        推到自检(courseId);
        主状态(courseId, "SUBMIT_REVIEW");
        assertTask("课程评审", CourseStateMachines.OBJECT_TYPE, courseId);

        // 4 课程优化（另一门课，避免与试讲路径冲突）
        long optimizeCourse = courses.initiate(课程表单("派生-课程优化", expectPublish));
        推到自检(optimizeCourse);
        主状态(optimizeCourse, "SUBMIT_REVIEW");
        long reviewId = reviews.listByCourse(optimizeCourse).get(0).id();
        reviewApplication.recordConclusion(reviewId, 评审结论(CourseEnums.REVIEW_REJECT_REVISE));
        assertTask("课程优化", CourseStateMachines.OBJECT_TYPE, optimizeCourse);

        // 5 讲师试讲
        long trialCourse = courses.initiate(课程表单("派生-讲师试讲", expectPublish));
        推到自检(trialCourse);
        主状态(trialCourse, "SUBMIT_REVIEW");
        long trialReview = reviews.listByCourse(trialCourse).get(0).id();
        reviewApplication.recordConclusion(trialReview, 评审结论(CourseEnums.REVIEW_PASS));
        assertTask("讲师试讲", CourseStateMachines.OBJECT_TYPE, trialCourse);

        // 6／7 签到导入 + 培训归档（场次结束一次派生两条）
        long sessionId = 造已开课场次();
        transitions.transit(new TransitCommand(TrainingStateMachines.SESSION_OBJECT_TYPE, sessionId,
                TrainingStateMachines.FIELD_SESSION_STATE, "FINISH", null, null));
        assertTask("签到导入", TrainingStateMachines.SESSION_OBJECT_TYPE, sessionId);
        assertTask("培训归档", TrainingStateMachines.SESSION_OBJECT_TYPE, sessionId);

        // 8 案例整理（CREATE_CASE）
        long promoCourse = 造推广中课程("派生-案例整理");
        主状态(promoCourse, "MARK_QUALIFIED");
        Long caseId = cases.findIdByCourse(promoCourse);
        assertThat(caseId).isNotNull();
        assertTask("案例整理", CaseStateMachines.OBJECT_TYPE, caseId);

        // 10 案例审核
        transitions.transit(new TransitCommand(CaseStateMachines.OBJECT_TYPE, caseId,
                CaseStateMachines.FIELD_CASE_STATE, "START_ORGANIZE", null, null));
        transitions.transit(new TransitCommand(CaseStateMachines.OBJECT_TYPE, caseId,
                CaseStateMachines.FIELD_CASE_STATE, "SUBMIT_AUDIT", null, null));
        assertTask("案例审核", CaseStateMachines.OBJECT_TYPE, caseId);

        Set<String> types = jdbc.queryForList("""
                SELECT DISTINCT task_type FROM sys_task WHERE deleted = FALSE AND derive_type = '系统派生'
                """, String.class).stream().collect(Collectors.toSet());
        assertThat(types).containsExactlyInAnyOrder(
                "需求评审", "课程开发", "课程评审", "课程优化", "讲师试讲",
                "签到导入", "培训归档", "案例整理", "业务验收", "案例审核");
    }

    @Test
    @DisplayName("CLOSE_RELATED_TASKS：关闭课程开发后未完成任务变已关闭")
    void 终态关闭未完成任务() {
        long courseId = courses.initiate(课程表单("关闭连带任务", LocalDate.now().plusDays(20)));
        Map<String, Object> task = assertTask("课程开发", CourseStateMachines.OBJECT_TYPE, courseId);
        long taskId = ((Number) task.get("id")).longValue();

        主状态(courseId, "CLOSE_DEVELOPMENT");

        assertThat(jdbc.queryForObject(
                "SELECT task_state FROM sys_task WHERE id = ?", String.class, taskId))
                .isEqualTo(TaskStateMachine.STATE_CLOSED);
    }

    @Test
    @DisplayName("E3-5：GET 任务列表可按负责人筛选；逾期实时算")
    void 按负责人筛选与逾期() {
        long courseId = courses.initiate(课程表单("负责人筛选", LocalDate.now().plusDays(10)));
        Map<String, Object> task = assertTask("课程开发", CourseStateMachines.OBJECT_TYPE, courseId);
        long taskId = ((Number) task.get("id")).longValue();
        jdbc.update("UPDATE sys_task SET due_date = CURRENT_DATE - 1 WHERE id = ?", taskId);

        TaskQuery mine = new TaskQuery();
        mine.setOwnerNo(ownerNo);
        mine.setPageSize(200);
        var minePage = taskQuery.page(mine);
        assertThat(minePage.records()).anyMatch(t -> t.id().equals(taskId) && t.overdue());

        TaskQuery other = new TaskQuery();
        other.setOwnerNo("NO-SUCH-OWNER");
        assertThat(taskQuery.page(other).total()).isZero();
    }

    private Map<String, Object> assertTask(String taskType, String objectType, long objectId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT id, due_date, task_state, owner_no, title
                  FROM sys_task
                 WHERE task_type = ? AND object_type = ? AND object_id = ? AND deleted = FALSE
                 ORDER BY id DESC
                """, taskType, objectType, objectId);
        assertThat(rows)
                .describedAs("应派生「%s」← %s#%d", taskType, objectType, objectId)
                .isNotEmpty();
        Map<String, Object> latest = rows.get(0);
        assertThat(latest.get("task_state")).isEqualTo(TaskStateMachine.STATE_PENDING);
        assertThat(latest.get("owner_no")).isEqualTo(ownerNo);
        return latest;
    }

    private void 走到已发布解决方案(long demandId) {
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_REVIEW_STATE, "START_REVIEW", null, null));
        demands.recordReviewConclusion(demandId, new DemandReviewForm(
                LocalDate.now(), "通过", "意见", DemandEnums.OUTLET_SOLUTION,
                demandService.get(demandId).getVersion()));
        demands.createSolution(demandId, "解决方案名称", demandService.get(demandId).getVersion());
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_SOLUTION_STATE, "PUBLISH_SOLUTION", null, null));
    }

    private void 推到自检(long courseId) {
        主状态(courseId, "START_DEVELOP");
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, courseId,
                CourseStateMachines.FIELD_DEV_STATE, "START_DEVELOP", null, null));
        主状态(courseId, "ENTER_SELF_CHECK");
    }

    private void 主状态(long courseId, String action) {
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, courseId,
                CourseStateMachines.FIELD_MAIN_STATE, action, null, null));
    }

    private long 造已开课场次() {
        long courseId = jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                        initiated_date, expect_publish_date, validity_period,
                                        main_state, created_by)
                VALUES (?, '场次课', '内部端到端课程', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '长期有效', ?, 'operator')
                RETURNING id
                """, Long.class, "KC" + System.nanoTime(), 作战单元(), ownerNo,
                CourseStateMachines.MAIN_PUBLISHED);
        long planId = training.createPlan(new TrainingPlanForm(
                "派生计划" + System.nanoTime(), courseId, ownerNo, "全员",
                LocalDate.now(), LocalDate.now().plusDays(10), 1, null));
        long lecturerId = 造讲师();
        long sessionId = training.createSession(planId, new TrainingSessionForm(
                "派生场次", courseId, lecturerId, LocalDate.now().plusDays(1),
                LocalTime.of(9, 0), LocalTime.of(12, 0), new BigDecimal("3.0"),
                TrainingEnums.FORM_OFFLINE, "报告厅", null, "全体客服", 30, null)).id();
        transitions.transit(new TransitCommand(TrainingStateMachines.SESSION_OBJECT_TYPE, sessionId,
                TrainingStateMachines.FIELD_SESSION_STATE, "START", null, null));
        return sessionId;
    }

    private long 造推广中课程(String name) {
        return jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                        initiated_date, expect_publish_date, validity_period,
                                        main_state, created_by)
                VALUES (?, ?, '内部端到端课程', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '长期有效', ?, 'operator')
                RETURNING id
                """, Long.class, "KC" + System.nanoTime(), name, 作战单元(), ownerNo,
                CourseStateMachines.MAIN_PROMOTION);
    }

    private CourseReviewForm 评审结论(String result) {
        return new CourseReviewForm(List.of("线下会议"), LocalDate.now(),
                "张三", result, "意见", null);
    }

    private DemandForm 需求表单(String name) {
        return new DemandForm(name, "COURSE", ownerNo, ownerNo,
                LocalDate.now().minusDays(3), LocalDate.now().plusDays(20),
                name + " 描述", "部门提出", "效率提升", "高");
    }

    private CourseForm 课程表单(String name, LocalDate expectPublish) {
        return new CourseForm(name + System.nanoTime(), "内部端到端课程", "COURSE", ownerNo,
                LocalDate.now().minusDays(10), expectPublish,
                name + " 简介", "一线", new BigDecimal("2.0"), null,
                "12 个月", null, List.of());
    }

    private String 造人员(String name) {
        String no = "T" + System.nanoTime() % 100000000L;
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, 'AI中心', '两者', '在职', 'operator')
                """, no, name);
        return no;
    }

    private long 造讲师() {
        String no = 造人员("场次讲师");
        return jdbc.queryForObject("""
                INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                                          expertise_domains, teaching_direction, join_type, joined_date,
                                          training_state, pool_state, created_by)
                VALUES (?, '场次讲师', ?, 'AI中心', '["课程"]'::jsonb, '测试方向', '运营手动添加',
                        CURRENT_DATE, '可上岗', '在池', 'operator')
                RETURNING id
                """, Long.class, "JS" + System.nanoTime(), no);
    }

    private String 作战单元() {
        return jdbc.queryForObject("""
                SELECT item_code FROM dict_item
                 WHERE dict_type = '作战单元' AND enabled = TRUE AND deleted = FALSE
                 ORDER BY id LIMIT 1
                """, String.class);
    }
}
