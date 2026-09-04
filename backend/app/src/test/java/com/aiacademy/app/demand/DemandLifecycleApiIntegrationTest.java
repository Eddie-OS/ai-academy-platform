package com.aiacademy.app.demand;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.common.security.AccountType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * 需求主线的端到端接口测试（阶段 2 B-6 批，出口准则 E2-1）。
 *
 * <p><b>与 B-1～B-4 四个测试类的分工</b>与课程侧相同：那四类走 Service 钉单条规则，这一类走 HTTP
 * 钉「串起来还能用」。需求这条线上串起来才暴露的问题有两类特别典型：<b>录入评审结论那一步同时写
 * 业务字段与两个状态字段</b>，任一半失败都会留下「已评审但没有出口」的需求；<b>分流之后的字段
 * 分属两组</b>，接口把出口二的动作发到出口一的状态字段上时，单测里各自都是对的。
 *
 * <p>正向流程的每一步打印成一行接口调用记录，人工验收直接贴进报告。
 */
@AutoConfigureMockMvc
class DemandLifecycleApiIntegrationTest extends IntegrationTest {

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
    @DisplayName("E2-1：登记 → 评审 → 出口二 → 立项开发上线 → 优化 → 关联课程 → 交付 → 验收 → 归档 全程走通")
    void 出口二主流程从登记走到归档() throws Exception {
        String employeeNo = 造人员("需求负责人");
        long demandId = 登记需求(employeeNo);
        assertThat(状态(demandId, "reviewState")).isEqualTo("待评审");

        转换(demandId, DemandStateMachines.FIELD_REVIEW_STATE, "START_REVIEW");
        录评审结论(demandId, DemandEnums.OUTLET_DEVELOPMENT);

        JsonNode reviewed = 详情(demandId);
        assertThat(reviewed.get("reviewState").asText()).isEqualTo("已评审");
        assertThat(reviewed.get("outlet").asText())
                .describedAs("需求 5.2.1：结论与出口同一笔事务，不存在「已评审但没有出口」的中间态")
                .isEqualTo(DemandEnums.OUTLET_DEVELOPMENT);
        assertThat(数据(调用("GET", "/api/demands/" + demandId + "/reviews", null)).size())
                .describedAs("第 1 轮评审记录随结论一起留档")
                .isEqualTo(1);

        for (String action : List.of("INITIATE", "ENQUEUE", "START_DEVELOP", "GO_LIVE")) {
            转换(demandId, DemandStateMachines.FIELD_DEV_STATE, action);
        }
        JsonNode online = 详情(demandId);
        assertThat(online.get("devState").asText()).isEqualTo("已上线");
        assertThat(online.get("currentProcessState").asText())
                .describedAs("需求 8.6：出口二的「当前处理状态」取需求开发状态")
                .isEqualTo("已上线");
        String firstOnline = online.get("firstOnlineDate").asText();
        assertThat(firstOnline).isEqualTo(LocalDate.now().toString());

        // 「已上线 → 优化中 → 已上线」不设次数上限，首次上线时间必须钉住不动：
        // 15.2 的需求处理周期取的是它，跟着最新一次走会让周期越优化越短
        转换(demandId, DemandStateMachines.FIELD_DEV_STATE, "START_OPTIMIZE");
        转换(demandId, DemandStateMachines.FIELD_DEV_STATE, "OPTIMIZE_GO_LIVE");
        JsonNode optimized = 详情(demandId);
        assertThat(optimized.get("optimizeCount").asInt()).isEqualTo(1);
        assertThat(optimized.get("firstOnlineDate").asText()).isEqualTo(firstOnline);

        long courseId = 建课程(employeeNo);
        关联课程(demandId, courseId);
        assertThat(数据(调用("GET", "/api/demands/" + demandId + "/courses", null)).size()).isEqualTo(1);
        JsonNode reverse = 数据(调用("GET", "/api/courses/" + courseId + "/demands", null));
        assertThat(reverse.size())
                .describedAs("规则 R4：同一份关联在课程侧反向可见")
                .isEqualTo(1);
        assertThat(reverse.get(0).get("demandId").asLong()).isEqualTo(demandId);

        调用("POST", "/api/demands/" + demandId + "/delivery?version=" + 版本(demandId), null);
        JsonNode delivered = 详情(demandId);
        assertThat(delivered.get("deliveryMark").asText()).isEqualTo("已交付");
        assertThat(delivered.get("acceptanceState").asText())
                .describedAs("验收点 A1-8：交付使用后业务验收状态自动置「待验收」")
                .isEqualTo("待验收");

        录验收结论(demandId, DemandEnums.ACCEPTANCE_PASS);
        assertThat(状态(demandId, "acceptanceState")).isEqualTo("验收通过");

        转换(demandId, DemandStateMachines.FIELD_DELIVERY_MARK, "ARCHIVE");
        JsonNode archived = 详情(demandId);
        assertThat(archived.get("deliveryMark").asText()).isEqualTo("已归档");
        assertThat(archived.get("archivedAt").asText()).isEqualTo(LocalDate.now().toString());

        JsonNode logs = 数据(调用("GET", "/api/demands/" + demandId + "/state-logs", null));
        List<String> devStates = new ArrayList<>();
        logs.forEach(row -> {
            if (DemandStateMachines.FIELD_DEV_STATE.equals(row.get("stateField").asText())) {
                devStates.add(row.get("toState").asText());
            }
        });
        assertThat(devStates)
                .describedAs("流转日志倒序，需求开发状态应完整覆盖 5.2.4 的正向主线与一次优化回环")
                .containsExactly("已上线", "优化中", "已上线", "开发中", "待开发", "已立项");

        System.out.println("=== E2-1 需求主流程（出口二）接口调用记录 ===");
        callLog.forEach(System.out::println);
    }

    @Test
    @DisplayName("E2-1：出口一的需求走「输出解决方案 → 发布 → 交付 → 验收」，不激活出口二的字段")
    void 出口一主流程() throws Exception {
        String employeeNo = 造人员("方案负责人");
        long demandId = 登记需求(employeeNo);

        转换(demandId, DemandStateMachines.FIELD_REVIEW_STATE, "START_REVIEW");
        录评审结论(demandId, DemandEnums.OUTLET_SOLUTION);

        String body = json.writeValueAsString(Map.of(
                "solutionName", "客服话术生成器配置方案", "version", 版本(demandId)));
        调用("POST", "/api/demands/" + demandId + "/solution", body);
        转换(demandId, DemandStateMachines.FIELD_SOLUTION_STATE, "PUBLISH_SOLUTION");

        JsonNode published = 详情(demandId);
        assertThat(published.get("solutionState").asText()).isEqualTo("已发布");
        assertThat(published.get("currentProcessState").asText())
                .describedAs("需求 8.6：出口一的「当前处理状态」取解决方案状态")
                .isEqualTo("已发布");
        assertThat(published.get("devState").isNull())
                .describedAs("两个出口的字段分属两组：出口一的需求上出现需求开发状态，"
                        + "说明动作发到了另一组状态字段上")
                .isTrue();
        assertThat(published.get("firstOnlineDate").isNull()).isTrue();

        调用("POST", "/api/demands/" + demandId + "/delivery?version=" + 版本(demandId), null);
        录验收结论(demandId, DemandEnums.ACCEPTANCE_REJECT);

        JsonNode rejected = 详情(demandId);
        assertThat(rejected.get("acceptanceState").asText()).isEqualTo("验收不通过");
        assertThat(rejected.get("solutionState").asText())
                .describedAs("需求 5.2.5 第 3 行：出口一验收不通过退回「已输出」")
                .isEqualTo("已输出");

        System.out.println("=== E2-1 需求主流程（出口一）接口调用记录 ===");
        callLog.forEach(System.out::println);
    }

    // -------------------------------------------------------------------------
    // E2-3 权限矩阵在需求页面上的落点
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-3／PM1：用户账号读得到需求的每一处，写一律 403 且不留痕迹")
    void 用户账号只读() throws Exception {
        long demandId = 登记需求(造人员("只读验证"));

        for (String path : List.of("/api/demands", "/api/demands/" + demandId,
                "/api/demands/" + demandId + "/reviews", "/api/demands/" + demandId + "/acceptances",
                "/api/demands/" + demandId + "/courses",
                "/api/demands/" + demandId + "/transitions/available",
                "/api/demands/" + demandId + "/state-logs")) {
            MvcResult result = mvc.perform(as查看(get(path))).andReturn();
            assertThat(json.readTree(响应体(result)).get("code").asText())
                    .describedAs("PMI-2：读接口对两个账号无差别，%s 也不例外", path)
                    .isEqualTo("OK");
        }

        // 需求侧的写接口有三类形态：统一转换、业务表单、关联维护。三类各拒一次，
        // 漏一类的典型症状是那一类的 Controller 上忘了 @WriteApi，而它不会有任何报错
        Map<String, MockHttpServletRequestBuilder> writes = new HashMap<>();
        writes.put("统一转换", post("/api/demands/{id}/transitions", demandId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "stateField", DemandStateMachines.FIELD_REVIEW_STATE,
                        "action", "START_REVIEW"))));
        writes.put("业务表单", post("/api/demands/{id}/delivery", demandId));
        writes.put("关联维护", delete("/api/demands/{id}/courses/{courseId}", demandId, 1L));

        for (Map.Entry<String, MockHttpServletRequestBuilder> entry : writes.entrySet()) {
            MvcResult result = mvc.perform(as查看(entry.getValue())).andReturn();
            assertThat(json.readTree(响应体(result)).get("code").asText())
                    .describedAs("%s 类写接口未被拒绝", entry.getKey())
                    .isEqualTo("FORBIDDEN");
        }

        assertThat(状态(demandId, "reviewState"))
                .describedAs("被拒的写请求不能留下任何痕迹")
                .isEqualTo("待评审");
        assertThat(数据(调用("GET", "/api/demands/" + demandId + "/state-logs", null)).size())
                .describedAs("只有登记那一条流转日志")
                .isEqualTo(1);
    }

    // -------------------------------------------------------------------------
    // E2-4 列表筛选与分页
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-4：需求列表按 pageNum 从 1 起分页，第二页不重复第一页，出口筛选走 outlet 列")
    void 列表分页与筛选() throws Exception {
        String employeeNo = 造人员("分页负责人");
        for (int i = 0; i < 3; i++) {
            登记需求(employeeNo);
        }
        long reviewed = 登记需求(employeeNo);
        转换(reviewed, DemandStateMachines.FIELD_REVIEW_STATE, "START_REVIEW");
        录评审结论(reviewed, DemandEnums.OUTLET_SOLUTION);

        String base = "/api/demands?ownerNo=" + employeeNo;
        JsonNode page1 = 数据(调用("GET", base + "&pageNum=1&pageSize=3", null));
        JsonNode page2 = 数据(调用("GET", base + "&pageNum=2&pageSize=3", null));

        assertThat(page1.get("total").asInt()).isEqualTo(4);
        assertThat(page1.get("records").size()).isEqualTo(3);
        assertThat(page2.get("records").size()).isEqualTo(1);

        List<Long> ids = new ArrayList<>();
        page1.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        page2.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        assertThat(ids)
                .describedAs("第二页重复第一页，是 offset 按 pageNum 而不是 pageNum-1 算的典型症状")
                .doesNotHaveDuplicates();

        // 出口值是中文，用 param() 而不是拼进查询串：拼串要自己编码，编错时表现为「筛不出来」，
        // 与「筛选条件没接上 SQL」的症状一模一样
        MvcResult filtered = mvc.perform(as运营(get("/api/demands")
                .param("ownerNo", employeeNo)
                .param("outlet", DemandEnums.OUTLET_SOLUTION))).andReturn();
        JsonNode byOutlet = json.readTree(响应体(filtered)).get("data");
        assertThat(byOutlet.get("total").asInt()).isEqualTo(1);
        assertThat(byOutlet.get("records").get(0).get("id").asLong()).isEqualTo(reviewed);
    }

    // -------------------------------------------------------------------------
    // 夹具：每一步都走真实 HTTP 接口
    // -------------------------------------------------------------------------

    private long 登记需求(String employeeNo) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "demandName", "端到端需求" + System.nanoTime(),
                "domainCode", "COURSE",
                "proposerNo", employeeNo,
                "ownerNo", employeeNo,
                "proposedDate", LocalDate.now().minusDays(10).toString(),
                "expectFinishDate", LocalDate.now().plusDays(30).toString(),
                "description", "端到端主流程验证用需求",
                "demandSource", "部门提出",
                "demandType", "效率提升",
                "priority", "P1（重要）"));
        return 数据(调用("POST", "/api/demands", body)).asLong();
    }

    private void 录评审结论(long demandId, String outlet) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "reviewDate", LocalDate.now().toString(),
                "reviewConclusion", "线下评审会同意推进",
                "reviewOpinion", "先做最小闭环",
                "outlet", outlet,
                "version", 版本(demandId)));
        调用("POST", "/api/demands/" + demandId + "/review-conclusion", body);
    }

    private void 录验收结论(long demandId, String result) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "acceptorName", "王班长",
                "acceptedAt", LocalDate.now().toString(),
                "acceptanceResult", result,
                "acceptanceOpinion", "线下确认结论",
                "version", 版本(demandId)));
        调用("POST", "/api/demands/" + demandId + "/acceptance-conclusion", body);
    }

    private void 关联课程(long demandId, long courseId) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "courseId", courseId, "linkNote", "该需求沉淀为一门课"));
        调用("POST", "/api/demands/" + demandId + "/courses", body);
    }

    private long 建课程(String ownerNo) throws Exception {
        Map<String, Object> form = new HashMap<>();
        form.put("courseName", "需求沉淀课程" + System.nanoTime());
        form.put("reviewTrack", CourseEnums.TRACK_INTERNAL);
        form.put("domainCode", "COURSE");
        form.put("ownerNo", ownerNo);
        form.put("initiatedDate", LocalDate.now().toString());
        form.put("expectPublishDate", LocalDate.now().plusDays(30).toString());
        form.put("summary", "需求↔课程关联验证用课程");
        form.put("targetAudience", "一线客服");
        form.put("classHours", "4.5");
        form.put("categoryCode", "INDIVIDUAL");
        form.put("source", "线下评审");
        form.put("validityPeriod", "12 个月");
        return 数据(调用("POST", "/api/courses", json.writeValueAsString(form))).asLong();
    }

    private void 转换(long demandId, String stateField, String action) throws Exception {
        String body = json.writeValueAsString(Map.of("stateField", stateField, "action", action));
        调用("POST", "/api/demands/" + demandId + "/transitions", body);
    }

    private JsonNode 详情(long demandId) throws Exception {
        return 数据(调用("GET", "/api/demands/" + demandId, null));
    }

    private String 状态(long demandId, String field) throws Exception {
        return 详情(demandId).get(field).asText();
    }

    private int 版本(long demandId) throws Exception {
        return 详情(demandId).get("version").asInt();
    }

    /** 统一走一遍真实接口，并记下这一行调用记录。 */
    private JsonNode 调用(String method, String path, String body) throws Exception {
        MockHttpServletRequestBuilder builder = "POST".equals(method) ? post(path) : get(path);
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(body);
        }

        MvcResult result = mvc.perform(as运营(builder)).andReturn();
        JsonNode response = json.readTree(响应体(result));
        // 动作码单列一栏：一串 POST /transitions 看不出这一步做的是什么，而这份记录是给人读的
        String action = body == null ? "" : json.readTree(body).path("action").asText("");
        callLog.add("%-4s %-48s %-24s → %s".formatted(
                method, path, action, response.get("code").asText()));

        assertThat(response.get("code").asText())
                .describedAs("%s %s 失败：%s", method, path, response.get("message"))
                .isEqualTo("OK");
        return response;
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

    private String 造人员(String name) {
        String no = "E" + System.nanoTime();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, '客服中心', '学员', '在职', 'operator')
                """, no, name);
        return no;
    }
}
