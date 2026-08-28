package com.aiacademy.app.dataimport;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.dataimport.domain.ImportBatch;
import com.aiacademy.platform.dataimport.domain.ImportPreview;
import com.aiacademy.platform.dataimport.domain.ImportTemplateSpec;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.service.ImportService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 导入相关集成测试的公共夹具。
 *
 * <p>造数一律走 SQL 直插，不走业务服务：阶段 1 明确不实现任何业务对象的 CRUD（开发 8.5 硬约束），
 * 场次、课程、试讲记录都还没有创建入口。这些行只是导入校验要用的「引用数据」，
 * 用 SQL 造它们不影响被测对象——被测的是导入框架与 6 个 Handler。
 *
 * <p>每个测试用自己的一组工号／场次号（带纳秒后缀），因此测试之间不需要清库，也不怕并行。
 */
abstract class ImportTestBase extends IntegrationTest {

    @Autowired
    protected ImportService imports;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    private List<com.aiacademy.platform.dataimport.ImportHandler> handlers;

    @BeforeEach
    void 以运营账号操作() {
        // 规则 I7：导入仅运营账号可用。接口层的拦截在 1D，这里设置的是留痕用的操作者（需求 5.12）
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 导入动作
    // -------------------------------------------------------------------------

    protected ImportTemplateSpec 模板(ImportType type) {
        return handlers.stream()
                .filter(handler -> handler.type() == type)
                .findFirst()
                .orElseThrow()
                .template();
    }

    protected ImportPreview 上传(ImportType type, List<List<String>> rows) {
        return 上传文件(type, ImportFile.of(模板(type), rows), "test.xlsx");
    }

    protected ImportPreview 上传文件(ImportType type, byte[] content, String fileName) {
        return imports.upload(type, fileName, new ByteArrayInputStream(content));
    }

    /** 上传 + 确认，返回批次号。断言校验通过——夹具数据出错时应当立刻看到原因。 */
    protected String 导入(ImportType type, List<List<String>> rows) {
        ImportPreview preview = 上传(type, rows);
        assertThat(preview.canConfirm())
                .describedAs("夹具数据未通过校验：%s", preview.errors())
                .isTrue();
        imports.confirm(preview.batchNo());
        return preview.batchNo();
    }

    protected ImportBatch 批次(String batchNo) {
        return jdbc.queryForObject("SELECT * FROM import_batch WHERE batch_no = ?",
                (rs, n) -> new ImportBatch(
                        rs.getLong("id"), rs.getString("batch_no"), rs.getString("import_type"),
                        rs.getString("file_name"), rs.getString("source_path"),
                        rs.getInt("total_rows"), rs.getInt("insert_rows"), rs.getInt("update_rows"),
                        rs.getString("batch_state"), rs.getString("import_result"),
                        rs.getString("error_report_path"),
                        rs.getObject("imported_at", java.time.OffsetDateTime.class),
                        rs.getObject("created_at", java.time.OffsetDateTime.class),
                        rs.getString("created_by")),
                batchNo);
    }

    // -------------------------------------------------------------------------
    // 引用数据
    // -------------------------------------------------------------------------

    protected String 造人员(String name, String dept) {
        String no = "E" + System.nanoTime();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, ?, '两者', '在职', 'OPS')
                """, no, name, dept);
        return no;
    }

    protected long 造课程(String ownerNo) {
        return jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                        initiated_date, expect_publish_date, validity_period,
                                        initiation_no, main_state, created_by)
                VALUES (?, '导入测试用课程', '内部端到端课程', 'COURSE', ?, CURRENT_DATE,
                        CURRENT_DATE + 30, '长期有效', ?, '立项', 'OPS')
                RETURNING id
                """, Long.class, "KC" + System.nanoTime(), ownerNo, "LI" + System.nanoTime());
    }

    protected long 造讲师(String employeeNo, String name, String trainingState) {
        return jdbc.queryForObject("""
                INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                                          expertise_domains, teaching_direction, join_type, joined_date,
                                          training_state, pool_state, created_by)
                VALUES (?, ?, ?, '客服中心', '["课程"]'::jsonb, '测试方向', '运营手动添加',
                        CURRENT_DATE, ?, '在池', 'OPS')
                RETURNING id
                """, Long.class,
                // 故意不用 JS+数字：夹具讲师不应参与讲师ID流水号的取最大值，否则导入生成的编号会被夹具顶到 8 位
                "JSFIX" + System.nanoTime(), name, employeeNo, trainingState);
    }

    /** 造一个指定状态的培训场次，返回场次号（导入模板的关联键）。 */
    protected String 造场次(String sessionState) {
        String owner = 造人员("负责人", "AI中心");
        long courseId = 造课程(owner);
        long lecturerId = 造讲师(造人员("讲师", "AI中心"), "讲师", "可上岗");
        long planId = jdbc.queryForObject("""
                INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                                               plan_start_date, plan_end_date, plan_state, created_by)
                VALUES (?, '导入测试用计划', ?, ?, '全体客服', CURRENT_DATE, CURRENT_DATE + 10,
                        '执行中', 'OPS')
                RETURNING id
                """, Long.class, "JH" + (System.nanoTime() % 1000000000), courseId, owner);

        String sessionNo = "JH" + (System.nanoTime() % 1000000000) + "-01";
        jdbc.update("""
                INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id, lecturer_id,
                                                  training_date, start_time, end_time, training_form,
                                                  student_scope, session_state, created_by)
                VALUES (?, ?, '第1场', ?, ?, CURRENT_DATE, '09:00', '12:00', '线下',
                        '全体客服', ?, 'OPS')
                """, sessionNo, planId, courseId, lecturerId, sessionState);
        return sessionNo;
    }

    protected long 场次ID(String sessionNo) {
        return jdbc.queryForObject(
                "SELECT id FROM biz_training_session WHERE session_no = ?", Long.class, sessionNo);
    }

    /** 造一条试讲记录，返回其数字主键——试讲反馈导入的关联键（需求 14.7 A 列）。 */
    protected long 造试讲记录() {
        String owner = 造人员("课程负责人", "AI中心");
        long courseId = 造课程(owner);
        long lecturerId = 造讲师(造人员("试讲讲师", "AI中心"), "试讲讲师", "培养中");
        return jdbc.queryForObject("""
                INSERT INTO dtl_course_trial (course_id, round_no, trial_date, lecturer_id,
                                              record_state, created_by)
                VALUES (?, 1, CURRENT_DATE, ?, '待录入结论', 'OPS')
                RETURNING id
                """, Long.class, courseId, lecturerId);
    }

    // -------------------------------------------------------------------------
    // 查询断言用
    // -------------------------------------------------------------------------

    protected List<Map<String, Object>> 行(String table, String batchNo) {
        return jdbc.queryForList(
                "SELECT * FROM " + table + " WHERE import_batch_no = ? ORDER BY id", batchNo);
    }

    protected int 计数(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    /**
     * 严格取列值：列名写错时直接失败，而不是像 {@code Map.get} 那样返回 null。
     *
     * <p>这一层不是讲究：断言「匿名反馈的部门列为 null」时，如果列名拼错，{@code Map.get} 返回 null，
     * 测试照样通过——一个专门保护匿名承诺的断言会变成永真式。
     */
    protected static Object 列(Map<String, Object> row, String column) {
        if (!row.containsKey(column)) {
            throw new IllegalArgumentException(
                    "表里没有「%s」这一列，实际列名：%s".formatted(column, row.keySet()));
        }
        return row.get(column);
    }
}
