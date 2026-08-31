package com.aiacademy.app.kase;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.kase.domain.CaseEnums;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.security.AccountType;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * 讲师与案例主线的端到端接口测试（阶段 2 D-5 批，出口准则 E2-1、E2-3、E2-4）。
 *
 * <p><b>与 {@code LecturerPoolIntegrationTest}／{@code CaseIntegrationTest}／
 * {@code CaseInteractionIntegrationTest} 的分工</b>：那三类走 Service 钉单条规则，这一类走 HTTP
 * 钉「串起来还能用」。D 段串起来才暴露的问题有两类：
 *
 * <ul>
 *   <li><b>案例不是自己冒出来的。</b>它由课程侧的一次状态转换派生，跨了两个业务模块与一个副作用。
 *       案例侧的测试全绿而这条链断掉时，症状是运营在课程上标了精品、案例列表里什么都没有；
 *   <li><b>用户账号能写。</b>这是全平台唯一一处，权限的三档划分只有走真实拦截器才验得到——
 *       Service 层没有账号类型这个概念。
 * </ul>
 *
 * <p><b>权限那三条为什么要查库确认。</b>{@code ArchitectureRulesTest.e1_5_userWritableWhitelistStaysAtTwo}
 * 在构建期把 {@code USER_ALLOWED} 锁在 {@code business.kase} 包内，管的是「白名单出现在哪」；
 * 这里管的是「白名单里装的是不是那三条，以及写进去的东西是真的」。注解贴对了包但贴错了方法，
 * 静态断言看不出来；返回 200 但静默丢弃，响应体上也看不出来。
 *
 * <p>正向流程的每一步打印成一行接口调用记录，人工验收直接贴进报告。
 */
@AutoConfigureMockMvc
class CaseLecturerLifecycleApiIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    private final List<String> callLog = new ArrayList<>();

    // -------------------------------------------------------------------------
    // E2-1 端到端主流程
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-1：讲师入池 → 课程达精品自动建案例 → 整理 → 审核 → 上架 → 互动 → 出报告 全程走通")
    void 案例主流程从课程达精品走到已上架() throws Exception {
        // 讲师侧：手动入池 → 改培养状态。两个枚举字段都不是状态机，走的是同一个编辑接口（TS1）
        String 讲师工号 = 造人员("端到端讲师", "客服中心");
        long lecturerId = 数据(调用("POST", "/api/lecturers",
                json.writeValueAsString(讲师表单(讲师工号, LecturerEnums.TRAINING_PENDING)))).asLong();
        JsonNode lecturer = 数据(调用("GET", "/api/lecturers/" + lecturerId, null));
        assertThat(lecturer.get("joinType").asText())
                .describedAs("需求 10.4 第 2 行：入池方式由路径决定，不从表单来")
                .isEqualTo("运营手动添加");
        assertThat(lecturer.get("avgScore").isNull())
                .describedAs("还没有人评过分时是「—」而不是 0.0（设计规范 3.3）")
                .isTrue();
        // 培养状态改值走的是普通编辑接口，不是 /transitions——它不是状态机（TS1），
        // 因此讲师侧全段没有一次状态转换调用。不写流转日志由 LecturerPoolIntegrationTest 钉住
        调用("PUT", "/api/lecturers/" + lecturerId,
                json.writeValueAsString(讲师表单(讲师工号, LecturerEnums.TRAINING_QUALIFIED)));
        调用("GET", "/api/lecturers/" + lecturerId + "/teaching-records", null);
        调用("GET", "/api/lecturers/trial-ledger?pageNum=1&pageSize=20", null);

        // 案例侧：唯一入口是课程标注达精品
        long courseId = 造推广中的课程("端到端精品课", 造人员("端到端课程负责人", "客服中心"));
        调用("POST", "/api/courses/" + courseId + "/transitions", json.writeValueAsString(Map.of(
                "stateField", CourseStateMachines.FIELD_MAIN_STATE, "action", "MARK_QUALIFIED")));

        long caseId = jdbc.queryForObject(
                "SELECT id FROM biz_case WHERE course_id = ?", Long.class, courseId);
        callLog.add("%-6s %-52s %-22s → %s".formatted(
                "(副作用)", "CREATE_CASE", "课程标注达精品", "案例 #" + caseId));

        JsonNode created = 数据(调用("GET", "/api/cases/" + caseId, null));
        assertThat(created.get("caseNo").asText())
                .describedAs("需求 12.3 第 1 项：案例号是 AL + 年月 + 流水")
                .matches("AL\\d{6}\\d{3,}");
        assertThat(created.get("courseName").asText())
                .describedAs("来源课程名由 app 层批量补，案例模块不认识 biz_course（AR-1）")
                .isEqualTo("端到端精品课");
        assertThat(created.get("publishedAt").isNull()).isTrue();

        调用("PUT", "/api/cases/" + caseId + "?version=" + created.get("version").asInt(),
                json.writeValueAsString(案例表单(created)));
        转换(caseId, "START_ORGANIZE");
        转换(caseId, "SUBMIT_AUDIT");

        String 审核人 = 造人员("端到端审核人", "AI 学院");
        调用("POST", "/api/cases/" + caseId + "/audit", json.writeValueAsString(Map.of(
                "reviewerNo", 审核人,
                "reviewedAt", LocalDate.now().toString(),
                "reviewOpinion", "内容完整，同意上架",
                "reviewResult", CaseEnums.AUDIT_PASS)));

        JsonNode published = 数据(调用("GET", "/api/cases/" + caseId, null));
        assertThat(published.get("caseState").asText()).isEqualTo(上架后的状态());
        assertThat(published.get("reviewerNo").asText())
                .describedAs("四个审核字段与状态转换同一笔事务，不存在「已上架但没有审核人」的中间态")
                .isEqualTo(审核人);
        assertThat(published.get("publishedAt").isNull())
                .describedAs("需求 12.3 第 15 项：上架时间由副作用写入，它是 15.5 案例上架周期的终点")
                .isFalse();

        // 互动：这一段用查看账号发起，它是需求 6.2.5 里唯一对用户开放的写入
        long viewId = published.get("viewId").asLong();
        用户调用("POST", "/api/cases/" + caseId + "/likes", null);
        用户调用("POST", "/api/cases/" + caseId + "/comments",
                json.writeValueAsString(Map.of("signature", "看客", "content", "这个案例很实用")));
        用户调用("PATCH", "/api/cases/" + caseId + "/views/" + viewId + "?seconds=60", null);

        JsonNode stats = 数据(调用("GET", "/api/cases/" + caseId + "/interactions", null));
        assertThat(stats.get("likeCount").asInt()).isEqualTo(1);
        assertThat(stats.get("commentCount").asInt()).isEqualTo(1);

        long reportId = 数据(调用("POST", "/api/case-reports",
                json.writeValueAsString(报告表单("端到端总结报告")))).asLong();
        JsonNode report = 数据(调用("GET", "/api/case-reports/" + reportId, null));
        assertThat(report.get("generateMode").asText()).isEqualTo("系统自动生成");
        assertThat(report.get("content").asText())
                .describedAs("需求 12.6：正文是三个段落的聚合数字，区间内刚上架的这一条要计进去")
                .contains("案例应用成果", "用户反馈", "培训执行情况")
                .doesNotContain("<li>上架案例数：0</li>", "<li>点赞量：0</li>");

        assertThat(状态序列(caseId))
                .describedAs("需求 5.9 的案例状态主线，含自动创建那一条「（空）→ 待整理」")
                .containsExactly(上架后的状态(), "待审核", "整理中", 初始状态());

        System.out.println("=== E2-1 讲师与案例主流程接口调用记录 ===");
        callLog.forEach(System.out::println);
    }

    // -------------------------------------------------------------------------
    // E2-4 列表筛选与分页
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-4／需求 12.7：案例列表按 pageNum 从 1 起分页，第二页不重复第一页，状态筛选走 case_state 列")
    void 案例列表分页与筛选() throws Exception {
        List<Long> 造出来的 = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            造出来的.add(造案例("分页用案例" + i));
        }
        long 已上架 = 造已上架案例("筛选用已上架案例");

        JsonNode page1 = 数据(调用("GET", "/api/cases?pageNum=1&pageSize=2", null));
        JsonNode page2 = 数据(调用("GET", "/api/cases?pageNum=2&pageSize=2", null));
        assertThat(page1.get("records").size()).isEqualTo(2);
        assertThat(page1.get("total").asInt()).isGreaterThanOrEqualTo(造出来的.size() + 1);

        List<Long> ids = new ArrayList<>();
        page1.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        page2.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        assertThat(ids)
                .describedAs("第二页重复第一页，是 offset 按 pageNum 而不是 pageNum-1 算的典型症状")
                .doesNotHaveDuplicates();

        MvcResult filtered = mvc.perform(as运营(get("/api/cases")
                .param("caseState", 上架后的状态())
                .param("pageSize", "200"))).andReturn();
        List<Long> byState = new ArrayList<>();
        json.readTree(响应体(filtered)).get("data").get("records")
                .forEach(row -> byState.add(row.get("id").asLong()));
        assertThat(byState).contains(已上架).doesNotContainAnyElementsOf(造出来的);
    }

    // -------------------------------------------------------------------------
    // E2-3 权限矩阵
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-3／PMI-2：讲师与案例两侧的读接口对查看账号一律 200")
    void 读接口对两个账号一致() throws Exception {
        long caseId = 造已上架案例("读接口用案例");
        long lecturerId = 造讲师("读接口用讲师");
        long reportId = 造报告();

        for (String path : List.of("/api/cases", "/api/cases/" + caseId,
                "/api/cases/" + caseId + "/comments",
                "/api/cases/" + caseId + "/interactions",
                "/api/cases/" + caseId + "/transitions/available",
                "/api/cases/" + caseId + "/state-logs",
                "/api/case-reports", "/api/case-reports/" + reportId,
                "/api/case-reports/preview?from=" + LocalDate.now().minusDays(30)
                        + "&to=" + LocalDate.now(),
                "/api/lecturers", "/api/lecturers/" + lecturerId,
                "/api/lecturers/" + lecturerId + "/teaching-records",
                "/api/lecturers/" + lecturerId + "/evaluations",
                "/api/lecturers/source-depts", "/api/lecturers/trial-ledger")) {
            assertThat(码(mvc.perform(as查看(get(path))).andReturn()))
                    .describedAs("PMI-2：读接口对两个账号无差别，%s 也不例外", path)
                    .isEqualTo("OK");
        }
    }

    @Test
    @DisplayName("需求 6.2.5 第 6～7 项：查看账号点赞、评论、回报时长都能写，且三条都真的落了库")
    void 用户账号可写的三条真的写进去了() throws Exception {
        long caseId = 造已上架案例("用户能写的案例");

        // viewId 由详情那次读产生：停留时长补的是请求方自己那次阅读，不是凭空新建一条记录
        JsonNode detail = 数据(mvc.perform(as查看(get("/api/cases/{id}", caseId))).andReturn());
        long viewId = detail.get("viewId").asLong();

        assertThat(码(mvc.perform(as查看(post("/api/cases/{id}/likes", caseId))).andReturn()))
                .isEqualTo("OK");
        assertThat(码(mvc.perform(as查看(post("/api/cases/{id}/comments", caseId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("signature", "看客", "content", "这条评论来自查看账号")))))
                .andReturn()))
                .isEqualTo("OK");
        assertThat(码(mvc.perform(as查看(patch("/api/cases/{id}/views/{viewId}", caseId, viewId)
                .param("seconds", "45"))).andReturn()))
                .isEqualTo("OK");

        JsonNode stats = 数据(mvc.perform(as查看(
                get("/api/cases/{id}/interactions", caseId))).andReturn());
        assertThat(stats.get("likeCount").asInt())
                .describedAs("返回 200 但没写库与真的写了，在响应体上看不出区别")
                .isEqualTo(1);
        assertThat(stats.get("commentCount").asInt()).isEqualTo(1);
        assertThat(stats.get("avgReadSeconds").asDouble()).isEqualTo(45.0);

        assertThat(jdbc.queryForObject("""
                SELECT account_type FROM dtl_case_comment
                 WHERE case_id = ? AND deleted = FALSE ORDER BY id DESC LIMIT 1
                """, String.class, caseId))
                .describedAs("互动三表记账号类型。写死成 OPS 时功能全对，只是二期开号后"
                        + "再也分不出哪些评论来自用户账号")
                .isEqualTo(OperatorAccount.USER.name());
    }

    @Test
    @DisplayName("E2-3：案例侧另外七个写接口对查看账号全拒，删评论与点赞只差一个注解取值")
    void 案例侧其余写接口一律拒绝() throws Exception {
        long caseId = 造已上架案例("查看账号改不动的案例");
        long reportId = 造报告();
        long commentId = 造评论(caseId);

        Map<String, MockHttpServletRequestBuilder> writes = new LinkedHashMap<>();
        writes.put("编辑案例", put("/api/cases/{id}", caseId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "caseName", "被查看账号改过的名字",
                        "contributingOrg", "客服中心",
                        "domainCodes", List.of(启用中的作战单元编码()),
                        "ownerNo", 造人员("改名用负责人", "客服中心")))));
        writes.put("删除案例", delete("/api/cases/{id}", caseId));
        writes.put("录入审核结论", post("/api/cases/{id}/audit", caseId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "reviewerNo", 造人员("查看账号冒充的审核人", "AI 学院"),
                        "reviewedAt", LocalDate.now().toString(),
                        "reviewResult", CaseEnums.AUDIT_PASS))));
        writes.put("统一转换", post("/api/cases/{id}/transitions", caseId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "stateField", CaseStateMachines.FIELD_CASE_STATE,
                        "action", "UNPUBLISH_FOR_REVISION"))));
        writes.put("删除评论", delete("/api/cases/{caseId}/comments/{id}", caseId, commentId));
        writes.put("生成报告", post("/api/case-reports")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(报告表单("查看账号生成的报告"))));
        writes.put("编辑报告", put("/api/case-reports/{id}", reportId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(报告表单("查看账号改过的报告"))));

        拒绝(writes);

        JsonNode after = 数据(mvc.perform(as查看(get("/api/cases/{id}", caseId))).andReturn());
        assertThat(after.get("caseName").asText())
                .describedAs("被拒的写请求不能留下任何痕迹")
                .isEqualTo("查看账号改不动的案例");
        assertThat(after.get("caseState").asText()).isEqualTo(上架后的状态());
        assertThat(数据(mvc.perform(as查看(
                get("/api/cases/{id}/interactions", caseId))).andReturn())
                .get("commentCount").asInt())
                .describedAs("删评论只有运营能做——共享账号分不出「自己的评论」")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("E2-3：讲师侧三个写接口对查看账号全拒——讲师没有任何对用户开放的写口")
    void 讲师侧写接口一律拒绝() throws Exception {
        long lecturerId = 造讲师("查看账号改不动的讲师");

        String employeeNo = jdbc.queryForObject(
                "SELECT employee_no FROM biz_lecturer WHERE id = ?", String.class, lecturerId);

        Map<String, MockHttpServletRequestBuilder> writes = new LinkedHashMap<>();
        writes.put("手动入池", post("/api/lecturers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(讲师表单(
                        造人员("被硬塞进池的人", "客服中心"), LecturerEnums.TRAINING_QUALIFIED))));
        writes.put("改培养状态", put("/api/lecturers/{id}", lecturerId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        讲师表单(employeeNo, LecturerEnums.TRAINING_QUALIFIED))));
        writes.put("移出讲师池", delete("/api/lecturers/{id}", lecturerId));

        拒绝(writes);

        assertThat(jdbc.queryForObject(
                "SELECT training_state FROM biz_lecturer WHERE id = ?", String.class, lecturerId))
                .describedAs("培养状态改值不走状态机（TS2），漏注解时没有任何别的防线拦得住它被改成可上岗")
                .isEqualTo(LecturerEnums.TRAINING_PENDING);
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private void 拒绝(Map<String, MockHttpServletRequestBuilder> writes) throws Exception {
        for (Map.Entry<String, MockHttpServletRequestBuilder> entry : writes.entrySet()) {
            assertThat(码(mvc.perform(as查看(entry.getValue())).andReturn()))
                    .describedAs("「%s」没有被拒绝", entry.getKey())
                    .isEqualTo("FORBIDDEN");
        }
    }

    private Map<String, Object> 报告表单(String name) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("reportName", name);
        form.put("periodStart", LocalDate.now().minusDays(30).toString());
        form.put("periodEnd", LocalDate.now().toString());
        return form;
    }

    private Map<String, Object> 讲师表单(String employeeNo, String trainingState) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("lecturerName", "权限用讲师");
        form.put("employeeNo", employeeNo);
        form.put("sourceDept", "零售");
        form.put("expertiseDomains", List.of(启用中的作战单元名称()));
        form.put("teachingDirection", "查看账号写不进来的授课方向");
        form.put("trainingState", trainingState);
        form.put("poolState", LecturerEnums.POOL_IN);
        return form;
    }

    /** 造一条停在第一档的案例：课程标注达精品，副作用建出来的那一条。 */
    private long 造案例(String caseName) throws Exception {
        long courseId = 造推广中的课程(caseName, 造人员(caseName + "负责人", "客服中心"));
        运营转换("courses", courseId, CourseStateMachines.FIELD_MAIN_STATE, "MARK_QUALIFIED");
        return jdbc.queryForObject(
                "SELECT id FROM biz_case WHERE course_id = ?", Long.class, courseId);
    }

    /** 走运营账号把案例推到末档：只有对外可见的案例才谈得上被用户账号点赞评论。 */
    private long 造已上架案例(String caseName) throws Exception {
        long caseId = 造案例(caseName);
        运营转换("cases", caseId, CaseStateMachines.FIELD_CASE_STATE, "START_ORGANIZE");
        运营转换("cases", caseId, CaseStateMachines.FIELD_CASE_STATE, "SUBMIT_AUDIT");
        assertThat(码(mvc.perform(as运营(post("/api/cases/{id}/audit", caseId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "reviewerNo", 造人员(caseName + "审核人", "AI 学院"),
                        "reviewedAt", LocalDate.now().toString(),
                        "reviewResult", CaseEnums.AUDIT_PASS))))).andReturn()))
                .isEqualTo("OK");
        return caseId;
    }

    /**
     * 直接用 SQL 造一门停在「推广」的课程。
     *
     * <p>不走课程的完整流转把它推上来：本类测的是讲师与案例侧，课程流程由 A 段的测试盯着，
     * 在这里重跑一遍只会让每个用例慢上一截，且课程流程一改这里就跟着红。
     */
    private long 造推广中的课程(String courseName, String ownerNo) {
        return jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                        initiated_date, expect_publish_date, validity_period,
                                        initiation_no, main_state, created_by)
                VALUES (?, ?, '内部端到端课程', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '长期有效', ?, ?, 'operator')
                RETURNING id
                """, Long.class, "KC" + System.nanoTime(), courseName, 启用中的作战单元编码(),
                ownerNo, "LI" + System.nanoTime(), CourseStateMachines.MAIN_PROMOTION);
    }

    /** 编辑表单照抄详情里的当前值，只为在主流程里真实调用一次编辑接口。 */
    private Map<String, Object> 案例表单(JsonNode current) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("caseName", current.get("caseName").asText());
        form.put("contributingOrg", current.get("contributingOrg").asText());
        form.put("domainCodes", List.of(启用中的作战单元编码()));
        form.put("ownerNo", current.get("ownerNo").asText());
        form.put("qualityMarks", List.of(CaseEnums.MARK_TOP));
        form.put("content", "<p>端到端补录的案例正文</p>");
        return form;
    }

    private long 造报告() throws Exception {
        return 数据(mvc.perform(as运营(post("/api/case-reports")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(报告表单("权限用报告" + System.nanoTime())))))
                .andReturn()).asLong();
    }

    /** 先由运营留一条评论，才能验证「查看账号删不掉它」。 */
    private long 造评论(long caseId) throws Exception {
        assertThat(码(mvc.perform(as运营(post("/api/cases/{id}/comments", caseId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("signature", "运营", "content", "只有运营能删的评论")))))
                .andReturn()))
                .isEqualTo("OK");
        return jdbc.queryForObject(
                "SELECT id FROM dtl_case_comment WHERE case_id = ? ORDER BY id DESC LIMIT 1",
                Long.class, caseId);
    }

    private long 造讲师(String name) throws Exception {
        Map<String, Object> form = 讲师表单(造人员(name, "客服中心"), LecturerEnums.TRAINING_PENDING);
        return 数据(mvc.perform(as运营(post("/api/lecturers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(form)))).andReturn()).asLong();
    }

    private void 运营转换(String segment, long id, String stateField, String action)
            throws Exception {
        assertThat(码(mvc.perform(as运营(post("/api/{segment}/{id}/transitions", segment, id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("stateField", stateField, "action", action))))).andReturn()))
                .describedAs("夹具本身失败了：%s %s", segment, action)
                .isEqualTo("OK");
    }

    /** 统一走一遍真实接口（运营账号），并记下这一行调用记录。 */
    private JsonNode 调用(String method, String path, String body) throws Exception {
        MvcResult result = mvc.perform(as运营(请求(method, path, body))).andReturn();
        return 记账(method, path, body, result);
    }

    /** 同上，但以查看账号发起——用户账号可写的那三条走这条路。 */
    private JsonNode 用户调用(String method, String path, String body) throws Exception {
        MvcResult result = mvc.perform(as查看(请求(method, path, body))).andReturn();
        return 记账(method + "*", path, body, result);
    }

    private MockHttpServletRequestBuilder 请求(String method, String path, String body) {
        MockHttpServletRequestBuilder builder = switch (method) {
            case "POST" -> post(path);
            case "PUT" -> put(path);
            case "PATCH" -> patch(path);
            default -> get(path);
        };
        return body == null ? builder
                : builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private JsonNode 记账(String method, String path, String body, MvcResult result)
            throws Exception {
        JsonNode response = json.readTree(响应体(result));
        // 动作码单列一栏：一串 POST /transitions 看不出这一步做的是什么，而这份记录是给人读的
        String action = body == null ? "" : json.readTree(body).path("action").asText("");
        callLog.add("%-6s %-52s %-22s → %s".formatted(
                method, path, action, response.get("code").asText()));

        assertThat(response.get("code").asText())
                .describedAs("%s %s 失败：%s", method, path, response.get("message"))
                .isEqualTo("OK");
        return response;
    }

    private void 转换(long caseId, String action) throws Exception {
        调用("POST", "/api/cases/" + caseId + "/transitions", json.writeValueAsString(
                Map.of("stateField", CaseStateMachines.FIELD_CASE_STATE, "action", action)));
    }

    /** 该案例的流转日志（倒序）里到达过的状态序列。 */
    private List<String> 状态序列(long caseId) throws Exception {
        List<String> states = new ArrayList<>();
        数据(调用("GET", "/api/cases/" + caseId + "/state-logs", null))
                .forEach(row -> states.add(row.get("toState").asText()));
        return states;
    }

    /** 转换表里 from 为空的那一条的目标状态，即案例的第一档。 */
    private String 初始状态() {
        return CaseStateMachines.caseState().transitions().stream()
                .filter(t -> t.from() == null)
                .findFirst()
                .orElseThrow()
                .to();
    }

    /** 审核通过后到达的那一档，即对外可见的状态。从转换表取，不写死状态值（STK-1、E2-6）。 */
    private String 上架后的状态() {
        return CaseStateMachines.caseState().transitions().stream()
                .filter(t -> CaseStateMachines.ACTION_AUDIT_PASS.equals(t.action()))
                .findFirst()
                .orElseThrow()
                .to();
    }

    /** 案例的应用领域存编码，讲师的擅长领域存名称——两处存法不同，夹具也要分开取。 */
    private String 启用中的作战单元编码() {
        return 启用中的作战单元("item_code");
    }

    private String 启用中的作战单元名称() {
        return 启用中的作战单元("item_name");
    }

    private String 启用中的作战单元(String column) {
        return jdbc.queryForObject("""
                SELECT %s FROM dict_item
                 WHERE dict_type = '作战单元' AND enabled = TRUE AND deleted = FALSE
                 ORDER BY id LIMIT 1
                """.formatted(column), String.class);
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

    private String 码(MvcResult result) throws Exception {
        return json.readTree(响应体(result)).get("code").asText();
    }

    private JsonNode 数据(MvcResult result) throws Exception {
        return json.readTree(响应体(result)).get("data");
    }

    private JsonNode 数据(JsonNode response) {
        return response.get("data");
    }

    /** MockMvc 默认按 ISO-8859-1 解码响应体，中文状态值会变成乱码，断言随之全部失败。 */
    private String 响应体(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private MockHttpServletRequestBuilder as运营(MockHttpServletRequestBuilder builder) {
        return builder.with(csrf()).with(user("operator")
                .authorities(new SimpleGrantedAuthority(AccountType.OPERATOR.authority())));
    }

    private MockHttpServletRequestBuilder as查看(MockHttpServletRequestBuilder builder) {
        return builder.with(csrf()).with(user("viewer")
                .authorities(new SimpleGrantedAuthority(AccountType.VIEWER.authority())));
    }
}
