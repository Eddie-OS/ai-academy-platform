package com.aiacademy.app.training;

import com.aiacademy.app.application.TrainingApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.business.training.domain.TrainingPlanForm;
import com.aiacademy.business.training.domain.TrainingSessionForm;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * 培训驾驶舱各测试类共用的夹具（阶段 2 C 段）。
 *
 * <p>课程与讲师用 SQL 直接造，不走它们各自的应用服务：这里要的只是一个能被引用的对象，
 * 让课程走完「立项 → … → 发布」十几步只会让培训的测试跟着课程状态机的改动一起碎。
 * 需要特定课程状态（排课校验二）时改一行 {@code main_state} 即可。
 */
abstract class TrainingTestBase extends IntegrationTest {

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected TrainingApplicationService trainingApplication;

    protected String ownerNo;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
        ownerNo = 造人员("培训负责人", "AI中心");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    /**
     * 造一整条链：课程 → 计划 → 场次，返回场次 ID。
     *
     * <p>参训名单、归档、反馈三个页签只需要「有一个场次」，中间的计划与课程是什么无关紧要。
     */
    protected long 造场次(String name) {
        long courseId = 造课程(name);
        long planId = trainingApplication.createPlan(计划表单(name, courseId));
        return trainingApplication.createSession(planId,
                场次表单(courseId, 造讲师(name + "讲师", "可上岗")).名称(name).build()).id();
    }

    protected TrainingPlanForm 计划表单(String name, long courseId) {
        return new TrainingPlanForm(name, courseId, ownerNo, "MSS 三层部门全体",
                LocalDate.now(), LocalDate.now().plusDays(30), 3, name + " 的备注");
    }

    protected SessionFormBuilder 场次表单(long courseId, long lecturerId) {
        return new SessionFormBuilder(courseId, lecturerId);
    }

    /**
     * 场次表单的构建器。
     *
     * <p>{@code TrainingSessionForm} 有 13 个字段，测试里逐个列出会让每个用例都在重复十来个
     * 无关紧要的值，真正在测的那一个字段反而看不见。
     */
    protected static final class SessionFormBuilder {
        private String sessionName = "第一场";
        private final long courseId;
        private long lecturerId;
        private LocalDate trainingDate = LocalDate.now().plusDays(7);
        private LocalTime startTime = LocalTime.of(9, 0);
        private LocalTime endTime = LocalTime.of(12, 0);
        private BigDecimal durationHours;
        private String trainingForm = TrainingEnums.FORM_OFFLINE;
        private String venue = "3 楼报告厅";
        private String onlineLink;

        private SessionFormBuilder(long courseId, long lecturerId) {
            this.courseId = courseId;
            this.lecturerId = lecturerId;
        }

        SessionFormBuilder 名称(String name) {
            this.sessionName = name;
            return this;
        }

        SessionFormBuilder 讲师(long id) {
            this.lecturerId = id;
            return this;
        }

        SessionFormBuilder 日期(LocalDate date) {
            this.trainingDate = date;
            return this;
        }

        SessionFormBuilder 时段(LocalTime start, LocalTime end) {
            this.startTime = start;
            this.endTime = end;
            return this;
        }

        SessionFormBuilder 时长(BigDecimal hours) {
            this.durationHours = hours;
            return this;
        }

        SessionFormBuilder 形式(String form, String venue, String onlineLink) {
            this.trainingForm = form;
            this.venue = venue;
            this.onlineLink = onlineLink;
            return this;
        }

        TrainingSessionForm build() {
            return new TrainingSessionForm(sessionName, courseId, lecturerId, trainingDate,
                    startTime, endTime, durationHours, trainingForm, venue, onlineLink,
                    "全体客服", 30, null);
        }
    }

    protected String 造人员(String name, String dept) {
        String no = "E" + System.nanoTime();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, ?, '两者', '在职', 'OPS')
                """, no, name, dept);
        return no;
    }

    /** 造一门指定主状态的课程。默认「发布」——排课校验二要求课程已发布，多数用例都需要它。 */
    protected long 造课程(String name, String mainState) {
        return jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                        initiated_date, expect_publish_date, validity_period,
                                        initiation_no, main_state, created_by)
                VALUES (?, ?, '内部端到端课程', 'COURSE', ?, CURRENT_DATE,
                        CURRENT_DATE + 30, '长期有效', ?, ?, 'OPS')
                RETURNING id
                """, Long.class, "KC" + System.nanoTime(), name, ownerNo,
                "LI" + System.nanoTime(), mainState);
    }

    protected long 造课程(String name) {
        return 造课程(name, "发布");
    }

    /** 造一名指定培养状态的讲师。「可上岗」是排课校验一的通过条件（规则 TS4）。 */
    protected long 造讲师(String name, String trainingState) {
        return jdbc.queryForObject("""
                INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                                          expertise_domains, teaching_direction, join_type, joined_date,
                                          training_state, pool_state, created_by)
                VALUES (?, ?, ?, 'AI中心', '["课程"]'::jsonb, '测试方向', '运营手动添加',
                        CURRENT_DATE, ?, '在池', 'OPS')
                RETURNING id
                """, Long.class,
                "JSFIX" + System.nanoTime(), name, 造人员(name, "AI中心"), trainingState);
    }
}
