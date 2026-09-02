package com.aiacademy.app.lecturer;

import com.aiacademy.app.application.CourseApplicationService;
import com.aiacademy.app.application.LecturerApplicationService;
import com.aiacademy.app.repository.LecturerBoardMapper;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.lecturer.domain.CertificationForm;
import com.aiacademy.business.lecturer.domain.CertificationRecord;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.lecturer.domain.LecturerForm;
import com.aiacademy.business.lecturer.domain.LecturerListItem;
import com.aiacademy.business.lecturer.domain.LecturerQuery;
import com.aiacademy.business.lecturer.domain.LevelLogForm;
import com.aiacademy.business.lecturer.domain.LevelLogRecord;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 讲师池与讲师详情（需求 10.3～10.7，页面 P3-1／P3-2）。
 *
 * <p>本类集中验证讲师模块与其他四个驾驶舱最不一样的三件事：
 * <ul>
 *   <li><b>没有状态机</b>：培养状态与在池状态改值只写操作审计日志，不写状态流转日志（规则 TS1、TS2）；
 *   <li><b>三项累计统计不落库</b>：授课次数、学员人次、平均评分实时从培训模块的三张表聚合（C14）；
 *   <li><b>入池方式由路径决定</b>：手动添加、批量导入、课程负责人自动入池三条路径各写各的值（需求 10.4）。
 * </ul>
 */
class LecturerPoolIntegrationTest extends IntegrationTest {

    @Autowired
    private LecturerApplicationService lecturers;

    @Autowired
    private CourseApplicationService courseApplication;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 入池（需求 10.4）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 10.4 第 2 行：手动添加的入池方式与入池时间由路径决定，不从表单来")
    void 手动添加讲师() {
        long id = lecturers.createManually(表单("手工讲师", 造人员("手工讲师", "客服中心")).build());

        LecturerListItem saved = lecturers.detail(id);
        assertThat(saved.getLecturerNo()).matches("JS\\d{4,}");
        assertThat(saved.getJoinType()).isEqualTo(LecturerEnums.JOIN_MANUAL);
        assertThat(saved.getJoinedDate()).isEqualTo(LocalDate.now());
        assertThat(saved.getTrialQualified())
                .describedAs("试讲合格标记只能由试讲结论录入产生，新增时一律为假")
                .isFalse();
    }

    @Test
    @DisplayName("需求 10.3 第 3 项：工号必须在人员台账里，且不能重复入池")
    void 工号校验() {
        String employeeNo = 造人员("老讲师", "客服中心");
        lecturers.createManually(表单("老讲师", employeeNo).build());

        assertThatThrownBy(() -> lecturers.createManually(表单("重复的人", employeeNo).build()))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED));

        assertThatThrownBy(() -> lecturers.createManually(表单("查无此人", "E-不存在").build()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("不在人员台账中");
    }

    @Test
    @DisplayName("来源部门是三层部门自由文本；擅长领域也是自由文本")
    void 来源部门与擅长领域自由填写() {
        String employeeNo = 造人员("领域讲师", "客服中心");

        long id = lecturers.createManually(
                表单("领域讲师", employeeNo).部门("市场营销部").领域("大模型应用落地").build());
        assertThat(lecturers.detail(id).getSourceDept()).isEqualTo("市场营销部");
        assertThat(lecturers.detail(id).getExpertiseDomains())
                .isEqualTo("[\"大模型应用落地\"]");
    }

    @Test
    @DisplayName("需求 10.3 第 15 项：移出讲师池必须填移出原因")
    void 移出必须填原因() {
        String employeeNo = 造人员("要移出的人", "客服中心");
        long id = lecturers.createManually(表单("要移出的人", employeeNo).build());

        assertThatThrownBy(() -> lecturers.update(id,
                表单("要移出的人", employeeNo).在池状态(LecturerEnums.POOL_OUT, null).build()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("移出原因");

        lecturers.update(id, 表单("要移出的人", employeeNo)
                .在池状态(LecturerEnums.POOL_OUT, "已转岗").build());
        assertThat(lecturers.detail(id).getPoolState()).isEqualTo(LecturerEnums.POOL_OUT);
    }

    @Test
    @DisplayName("规则 TS2：培养状态改值不写状态流转日志，只写操作审计日志")
    void 培养状态改值不写流转日志() {
        String employeeNo = 造人员("升级的人", "客服中心");
        long id = lecturers.createManually(表单("升级的人", employeeNo)
                .培养状态(LecturerEnums.TRAINING_PENDING).build());

        lecturers.update(id, 表单("升级的人", employeeNo)
                .培养状态(LecturerEnums.TRAINING_QUALIFIED).build());

        assertThat(lecturers.detail(id).getTrainingState()).isEqualTo(LecturerEnums.TRAINING_QUALIFIED);
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM audit_state_log WHERE object_type = 'LECTURER'
                """, Integer.class))
                .describedAs("培养状态是自由选择的枚举（TS1）。写进流转日志会污染按流转算的 9 个效率指标")
                .isZero();
        assertThat(lecturers.statusFieldLogs(id))
                .extracting(row -> row.fieldName())
                .contains("培养状态");
    }

    @Test
    @DisplayName("需求 10.4 第 1 行：课程立项时负责人自动入池，擅长领域与授课方向留「待补充」")
    void 课程负责人自动入池() {
        String ownerNo = 造人员("新负责人", "MSS 一部");

        long courseId = courseApplication.initiate(课程表单("自动入池课程", ownerNo));

        long id = jdbc.queryForObject(
                "SELECT id FROM biz_lecturer WHERE employee_no = ?", Long.class, ownerNo);
        LecturerListItem auto = lecturers.detail(id);
        assertThat(auto.getJoinType()).isEqualTo(LecturerEnums.JOIN_AUTO_COURSE_OWNER);
        assertThat(auto.getSourceDept())
                .describedAs("需求 10.4 末段：来源部门从人员台账带出")
                .isEqualTo("MSS 一部");
        assertThat(auto.getTrainingState())
                .describedAs("规则 TS3：已经在做课程的人比全新讲师靠前")
                .isEqualTo(LecturerEnums.TRAINING_IN_PROGRESS);
        assertThat(auto.getExpertiseDomains()).isEqualTo("[]");
        assertThat(auto.getTeachingDirection()).isEqualTo("待补充");

        // 再编辑一次课程：同一个工号不重复建，否则每次编辑都会撞唯一约束
        courseApplication.update(courseId, 课程表单("自动入池课程", ownerNo), null);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM biz_lecturer WHERE employee_no = ?", Integer.class, ownerNo))
                .isEqualTo(1);
    }

    // -------------------------------------------------------------------------
    // 三项累计统计与两个页签（需求 10.3 第 11–13 项、10.5、10.6）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 10.3 第 11–13 项：三项累计统计实时聚合，只数上完了的场次")
    void 累计统计实时算() {
        String employeeNo = 造人员("上课的人", "客服中心");
        long id = lecturers.createManually(表单("上课的人", employeeNo).build());

        long finished = 造场次(id, "已结束");
        造签到(finished, 2, 1);
        造反馈(finished, 4, 5);
        long archived = 造场次(id, "已归档");
        造签到(archived, 3, 0);
        long upcoming = 造场次(id, "待开课");
        造签到(upcoming, 9, 0);

        LecturerListItem stats = lecturers.detail(id);
        assertThat(stats.getTeachingCount())
                .describedAs("待开课的场次还没上完，计进来会把「上过几次课」变成「排过几次课」")
                .isEqualTo(2);
        assertThat(stats.getAttendeeCount())
                .describedAs("累计学员人次 = 已签到的条数，未签到与未开课的不算")
                .isEqualTo(5);
        assertThat(stats.getAvgScore())
                .describedAs("设计规范 3.3：平均评分保留 1 位小数，在 SQL 里算完再回前端")
                .isEqualByComparingTo("4.5");

        assertThat(lecturers.teachingRecords(id))
                .extracting(LecturerBoardMapper.TeachingRecordRow::sessionId)
                .containsExactlyInAnyOrder(finished, archived);
        assertThat(lecturers.teachingRecords(id))
                .extracting(LecturerBoardMapper.TeachingRecordRow::trainingForm)
                .containsOnly("线下");
        assertThat(lecturers.evaluations(id)).hasSize(2);
    }

    @Test
    @DisplayName("认证记录只落库，不改档案、不做认证审批")
    void 认证记录只记录() {
        long id = lecturers.createManually(表单("认证讲师", 造人员("认证讲师", "客服中心")).build());
        String archiveLevel = lecturers.detail(id).getLecturerLevel();

        long recordId = lecturers.createCertification(id, new CertificationForm(
                "2026-08 批次", "L2", "已认证", "张小北", "准予认证",
                LocalDate.of(2026, 8, 31), LocalDate.of(2026, 8, 31), LocalDate.of(2027, 8, 31)));

        CertificationRecord row = lecturers.certificationRecords(id).get(0);
        assertThat(row.getId()).isEqualTo(recordId);
        assertThat(row.getCertBatch()).isEqualTo("2026-08 批次");
        assertThat(row.getCertState()).isEqualTo("已认证");
        assertThat(lecturers.detail(id).getLecturerLevel()).isEqualTo(archiveLevel);

        lecturers.removeCertification(id, recordId);
        assertThat(lecturers.certificationRecords(id)).isEmpty();
    }

    @Test
    @DisplayName("等级变更编号系统生成，不改档案等级")
    void 等级变更只记录() {
        long id = lecturers.createManually(表单("等级讲师", 造人员("等级讲师", "客服中心")).build());
        String archiveLevel = lecturers.detail(id).getLecturerLevel();

        long recordId = lecturers.createLevelLog(id, new LevelLogForm(
                "定期评审", "由 L0 变更为 L1", LocalDate.of(2026, 8, 20),
                "L1", "张小北", "能力达标"));

        LevelLogRecord row = lecturers.listLevelLogs(id).get(0);
        assertThat(row.getId()).isEqualTo(recordId);
        assertThat(row.getChangeNo()).matches("BG\\d{4,}");
        assertThat(row.getLevelAfter()).isEqualTo("L1");
        assertThat(lecturers.detail(id).getLecturerLevel())
                .describedAs("变更后等级只挂在台账上，档案等级保持原样")
                .isEqualTo(archiveLevel);

        lecturers.removeLevelLog(id, recordId);
        assertThat(lecturers.listLevelLogs(id)).isEmpty();
    }

    @Test
    @DisplayName("需求 10.7：默认按累计授课次数降序，平均评分区间筛的是算出来的均分")
    void 列表排序与评分筛选() {
        long 多课的 = lecturers.createManually(
                表单("多课的", 造人员("多课的", "排序部门")).部门("排序部门").build());
        造签到(造场次(多课的, "已结束"), 1, 0);
        造签到(造场次(多课的, "已结束"), 1, 0);
        long 少课的 = lecturers.createManually(
                表单("少课的", 造人员("少课的", "排序部门")).部门("排序部门").build());
        造反馈(造场次(少课的, "已结束"), 3);

        LecturerQuery query = new LecturerQuery();
        query.setSourceDept("排序部门");
        assertThat(lecturers.page(query).records())
                .extracting(LecturerListItem::getId)
                .containsExactly(多课的, 少课的);

        query.setScoreFrom(new BigDecimal("4.0"));
        assertThat(lecturers.page(query).records())
                .describedAs("「平均评分 ≥ 4」问的是评分够高的人，还没人评过的讲师回答不了这个问题")
                .isEmpty();
    }

    @Test
    @DisplayName("SEC2：上过课的讲师不能删除，运营真正要做的是把在池状态改成「已移出」")
    void 被引用的讲师不能删除() {
        String employeeNo = 造人员("有课的人", "客服中心");
        long id = lecturers.createManually(表单("有课的人", employeeNo).build());
        造场次(id, "已结束");

        assertThatThrownBy(() -> lecturers.softDelete(id))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED))
                .hasMessageContaining("已移出");

        long 没课的 = lecturers.createManually(表单("没课的人", 造人员("没课的人", "客服中心")).build());
        lecturers.softDelete(没课的);
        assertThat(jdbc.queryForObject(
                "SELECT deleted FROM biz_lecturer WHERE id = ?", Boolean.class, 没课的)).isTrue();
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private FormBuilder 表单(String name, String employeeNo) {
        return new FormBuilder(name, employeeNo, 启用中的作战单元());
    }

    /**
     * 讲师表单的构建器。
     *
     * <p>八个字段里每个用例只关心一两个，逐个列出会让真正在测的那一个字段淹没在样板里。
     */
    private static final class FormBuilder {
        private final String name;
        private final String employeeNo;
        private String sourceDept = "零售";
        private List<String> domains;
        private String trainingState = LecturerEnums.TRAINING_IN_PROGRESS;
        private String poolState = LecturerEnums.POOL_IN;
        private String removedReason;

        private FormBuilder(String name, String employeeNo, String domain) {
            this.name = name;
            this.employeeNo = employeeNo;
            this.domains = List.of(domain);
        }

        FormBuilder 部门(String dept) {
            this.sourceDept = dept;
            return this;
        }

        FormBuilder 领域(String... values) {
            this.domains = List.of(values);
            return this;
        }

        FormBuilder 培养状态(String state) {
            this.trainingState = state;
            return this;
        }

        FormBuilder 在池状态(String state, String reason) {
            this.poolState = state;
            this.removedReason = reason;
            return this;
        }

        LecturerForm build() {
            return new LecturerForm(name, employeeNo, sourceDept, domains, "AI 应用",
                    trainingState, poolState, removedReason,
                    null, null, null, null, null, null, null, null, null, null);
        }
    }

    private CourseForm 课程表单(String name, String ownerNo) {
        return new CourseForm(name, "内部端到端课程", 启用中的作战单元编码(), ownerNo,
                LocalDate.now(), LocalDate.now().plusDays(30), null, null, null, null, null, null,
                "长期有效", null, List.of());
    }

    private String 启用中的作战单元() {
        return jdbc.queryForObject("""
                SELECT item_name FROM dict_item
                 WHERE dict_type = '作战单元' AND enabled = TRUE AND deleted = FALSE
                 ORDER BY id LIMIT 1
                """, String.class);
    }

    private String 启用中的作战单元编码() {
        return jdbc.queryForObject("""
                SELECT item_code FROM dict_item
                 WHERE dict_type = '作战单元' AND enabled = TRUE AND deleted = FALSE
                 ORDER BY id LIMIT 1
                """, String.class);
    }

    private String 造人员(String name, String dept) {
        String no = "E" + System.nanoTime();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, ?, '两者', '在职', 'operator')
                """, no, name, dept);
        return no;
    }

    /** 造一条「课程 → 计划 → 场次」的最小链，返回场次 ID。三张表用 SQL 直接写。 */
    private long 造场次(long lecturerId, String sessionState) {
        long courseId = jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                        initiated_date, expect_publish_date, validity_period,
                                        initiation_no, main_state, created_by)
                VALUES (?, '统计用课程', '内部端到端课程', 'COURSE', ?, CURRENT_DATE,
                        CURRENT_DATE + 30, '长期有效', ?, '发布', 'operator')
                RETURNING id
                """, Long.class, "KC" + System.nanoTime(), 造人员("统计课负责人", "客服中心"),
                "LI" + System.nanoTime());
        long planId = jdbc.queryForObject("""
                INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                                               plan_start_date, plan_end_date, plan_state, created_by)
                VALUES (?, '统计用计划', ?, ?, '全体', CURRENT_DATE, CURRENT_DATE + 30,
                        '执行中', 'operator')
                RETURNING id
                """, Long.class, "JH" + System.nanoTime(), courseId, 造人员("统计计划负责人", "客服中心"));
        return jdbc.queryForObject("""
                INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id,
                                                  lecturer_id, training_date, start_time, end_time,
                                                  training_form, student_scope, session_state, created_by)
                VALUES (?, ?, '统计用场次', ?, ?, CURRENT_DATE, '09:00', '12:00',
                        '线下', '全体', ?, 'operator')
                RETURNING id
                """, Long.class, "CC" + System.nanoTime(), planId, courseId, lecturerId, sessionState);
    }

    private void 造签到(long sessionId, int present, int absent) {
        for (int i = 0; i < present + absent; i++) {
            jdbc.update("""
                    INSERT INTO dtl_attendance (session_id, employee_no, employee_name_snapshot,
                                                attend_status, created_by)
                    VALUES (?, ?, '学员', ?, 'operator')
                    """, sessionId, "E" + System.nanoTime(), i < present ? "已签到" : "未签到");
        }
    }

    private void 造反馈(long sessionId, int... scores) {
        for (int score : scores) {
            jdbc.update("""
                    INSERT INTO dtl_training_feedback (session_id, submitter_name, score,
                                                       import_batch_no, created_by)
                    VALUES (?, '学员', ?, 'B1', 'operator')
                    """, sessionId, score);
        }
    }
}
