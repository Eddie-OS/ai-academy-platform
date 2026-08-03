package com.aiacademy.app.course;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.common.security.AccountType;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * 课程主线的端到端接口测试（阶段 2 A-6 批，出口准则 E2-1）。
 *
 * <p><b>与前四批的分工。</b>A-2～A-4 的三个测试类走 Service，钉的是单条规则；这一类走 HTTP，
 * 钉的是「把它们串起来还能用」。串起来才暴露的问题是另一类：接口路径拼错、请求体字段名与前端
 * 约定不一致、某一步要求的前置数据其实上一步没产生。这些在分头测试里全都看不见——每个 Service
 * 单独调用时都是对的。
 *
 * <p>正向流程的每一步都打印成一行接口调用记录，人工验收时直接贴进报告（阶段提示词的出口准则
 * 第一条要求「附每一步的接口调用记录」）。
 */
@AutoConfigureMockMvc
class CourseLifecycleApiIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    /** 正向流程的接口调用记录，测试末尾打印。 */
    private final List<String> callLog = new ArrayList<>();

    // -------------------------------------------------------------------------
    // E2-1 端到端主流程
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-1：立项 → 开发 → 自检 → 评审 → 试讲 → 发布 → 推广 → 精品案例 → 案例归档 全程走通")
    void 主流程从立项走到案例归档() throws Exception {
        String ownerNo = 造人员("课程负责人");
        long lecturerId = 造讲师("王讲师");

        long courseId = 立项(ownerNo);
        assertThat(主状态(courseId)).isEqualTo("立项");

        转换(courseId, "课程主状态", "START_DEVELOP");
        转换(courseId, "课程开发状态", "START_DEVELOP");
        assertThat(主状态(courseId)).isEqualTo("开发");

        挂课件(courseId, "第一章.pptx");
        转换(courseId, "课程主状态", "ENTER_SELF_CHECK");
        勾一条自检(courseId);
        assertThat(主状态(courseId)).isEqualTo("自检");

        // 提交评审的三个副作用在同一笔事务里：快照 V1、开第 1 轮评审记录、派生任务
        转换(courseId, "课程主状态", "SUBMIT_REVIEW");
        assertThat(主状态(courseId)).isEqualTo("评审决策");
        JsonNode round1 = 数据(调用("GET", "/api/courses/" + courseId + "/reviews", null)).get(0);
        assertThat(round1.get("roundNo").asInt()).isEqualTo(1);
        assertThat(round1.get("boundVersionNo").asText())
                .describedAs("规则 R7：评审记录建的时候就把材料版本钉死")
                .isEqualTo("V1");

        录评审结论(round1.get("id").asLong(), CourseEnums.REVIEW_PASS);
        assertThat(主状态(courseId)).isEqualTo("试讲");

        long trialId = 建试讲(courseId, lecturerId);
        转换(courseId, "试讲状态", "START_TRIAL");
        录试讲结论(trialId);
        assertThat(主状态(courseId)).isEqualTo("发布");

        JsonNode published = 数据(调用("GET", "/api/courses/" + courseId, null));
        assertThat(published.get("publishState").asText()).isEqualTo("已发布");
        assertThat(published.get("firstPublishDate").isNull())
                .describedAs("EX1：首次进入发布要写下首次发布时间，有效期截止日按它算")
                .isFalse();
        assertThat(published.get("validityEndDate").isNull()).isFalse();

        转换(courseId, "课程主状态", "ENTER_PROMOTION");
        转换(courseId, "课程主状态", "MARK_QUALIFIED");
        转换(courseId, "课程主状态", "ARCHIVE_AFTER_CASE_PUBLISHED");
        assertThat(主状态(courseId)).isEqualTo("案例归档");

        JsonNode logs = 数据(调用("GET", "/api/courses/" + courseId + "/state-logs", null));
        List<String> mainStates = new ArrayList<>();
        logs.forEach(row -> {
            if ("课程主状态".equals(row.get("stateField").asText())) {
                mainStates.add(row.get("toState").asText());
            }
        });
        assertThat(mainStates)
                .describedAs("流转日志倒序，主状态应完整覆盖需求 5.3.1 的正向主线")
                .containsExactly("案例归档", "精品案例", "推广", "发布", "试讲", "评审决策",
                        "自检", "开发", "立项");

        System.out.println("=== E2-1 主流程接口调用记录 ===");
        callLog.forEach(System.out::println);
    }

    // -------------------------------------------------------------------------
    // 并发
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("K1：两个运营同时点「提交评审」，只产生一条第 1 轮记录与一个 V1 版本")
    void 并发提交评审只开一轮() throws Exception {
        String ownerNo = 造人员("并发负责人");
        long courseId = 立项(ownerNo);
        转换(courseId, "课程主状态", "START_DEVELOP");
        转换(courseId, "课程主状态", "ENTER_SELF_CHECK");
        挂课件(courseId, "送评课件.pptx");

        // 两个共享同一账号的运营在各自浏览器上点了同一个按钮。这不是理论上的并发——
        // 全平台只有两个共享账号（AC1），2–4 名运营并行录入，这种双击是日常
        int version = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        String body = json.writeValueAsString(Map.of(
                "stateField", "课程主状态", "action", "SUBMIT_REVIEW", "version", version));

        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger ok = new AtomicInteger();
        List<String> failureCodes = java.util.Collections.synchronizedList(new ArrayList<>());
        ExecutorService pool = Executors.newFixedThreadPool(2);

        for (int i = 0; i < 2; i++) {
            pool.submit(() -> {
                try {
                    start.await();
                    MvcResult result = mvc.perform(as运营(
                                    post("/api/courses/{id}/transitions", courseId))
                                    .contentType(MediaType.APPLICATION_JSON).content(body))
                            .andReturn();
                    String code = json.readTree(响应体(result)).get("code").asText();
                    if ("OK".equals(code)) {
                        ok.incrementAndGet();
                    } else {
                        failureCodes.add(code);
                    }
                } catch (Exception e) {
                    failureCodes.add(e.getClass().getSimpleName());
                }
                return null;
            });
        }
        start.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(30, TimeUnit.SECONDS)).isTrue();

        assertThat(ok.get()).describedAs("恰好一次成功").isEqualTo(1);
        assertThat(failureCodes)
                .describedAs("""
                        另一次必须被明确拒绝并给出可解释的 code：CONCURRENT_MODIFIED（版本号过期）
                        或 ILLEGAL_TRANSITION（课程已不在自检）。落到 INTERNAL_ERROR 说明并发是靠
                        数据库唯一约束兜住的，那时运营看到的是一句系统异常""")
                .hasSize(1)
                .allSatisfy(code -> assertThat(code)
                        .isIn("CONCURRENT_MODIFIED", "ILLEGAL_TRANSITION", "DUPLICATE_SUBMIT"));

        assertThat(数据(调用("GET", "/api/courses/" + courseId + "/reviews", null)).size())
                .describedAs("并发下多开一轮评审记录，轮次编号从此与实际评审次数对不上，且无法事后修正")
                .isEqualTo(1);
        assertThat(数据(调用("GET", "/api/courses/" + courseId + "/material-versions", null)).size())
                .describedAs("材料版本同理：多出来的 V2 会让第 1 轮评审看起来评的是另一版")
                .isEqualTo(1);
    }

    // -------------------------------------------------------------------------
    // E2-3 权限矩阵在课程页面上的落点
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-3／PM1：用户账号读得到课程的每一处，写一律 403")
    void 用户账号只读() throws Exception {
        String ownerNo = 造人员("只读验证");
        long courseId = 立项(ownerNo);

        for (String path : List.of("/api/courses", "/api/courses/" + courseId,
                "/api/courses/" + courseId + "/reviews", "/api/courses/" + courseId + "/trials",
                "/api/courses/" + courseId + "/materials", "/api/courses/" + courseId + "/selfcheck",
                "/api/courses/" + courseId + "/schedules",
                "/api/courses/" + courseId + "/transitions/available",
                "/api/courses/" + courseId + "/state-logs")) {
            MvcResult result = mvc.perform(as查看(get(path))).andReturn();
            assertThat(json.readTree(响应体(result)).get("code").asText())
                    .describedAs("PMI-2：读接口对两个账号无差别，%s 也不例外", path)
                    .isEqualTo("OK");
        }

        MvcResult write = mvc.perform(as查看(post("/api/courses/{id}/transitions", courseId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stateField":"课程主状态","action":"START_DEVELOP"}"""))
                .andReturn();
        assertThat(json.readTree(响应体(write)).get("code").asText())
                .isEqualTo("FORBIDDEN");
        assertThat(主状态(courseId))
                .describedAs("被拒的写请求不能留下任何痕迹")
                .isEqualTo("立项");
    }

    // -------------------------------------------------------------------------
    // E2-4 列表分页
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-4：分页按 pageNum 从 1 起，第二页不重复第一页的记录，总数与实际一致")
    void 列表分页() throws Exception {
        String ownerNo = 造人员("分页负责人");
        for (int i = 0; i < 3; i++) {
            立项(ownerNo);
        }

        JsonNode page1 = 数据(调用("GET",
                "/api/courses?ownerNo=" + ownerNo + "&pageNum=1&pageSize=2", null));
        JsonNode page2 = 数据(调用("GET",
                "/api/courses?ownerNo=" + ownerNo + "&pageNum=2&pageSize=2", null));

        assertThat(page1.get("total").asInt()).isEqualTo(3);
        assertThat(page1.get("records").size()).isEqualTo(2);
        assertThat(page2.get("records").size()).isEqualTo(1);

        List<Long> ids = new ArrayList<>();
        page1.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        page2.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        assertThat(ids).describedAs("第二页重复第一页的记录，是 offset 按 pageNum 而不是 pageNum-1 算的典型症状")
                .doesNotHaveDuplicates();
    }

    // -------------------------------------------------------------------------
    // 夹具：每一步都走真实 HTTP 接口
    // -------------------------------------------------------------------------

    private long 立项(String ownerNo) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "courseName", "端到端课程" + System.nanoTime(),
                "reviewTrack", CourseEnums.TRACK_INTERNAL,
                "domainCode", "COURSE",
                "ownerNo", ownerNo,
                "initiatedDate", LocalDate.now().toString(),
                "expectPublishDate", LocalDate.now().plusDays(30).toString(),
                "summary", "端到端主流程验证用课程",
                "targetAudience", "一线客服",
                "validityPeriod", "12 个月"));
        return 数据(调用("POST", "/api/courses", body)).asLong();
    }

    private void 转换(long courseId, String stateField, String action) throws Exception {
        String body = json.writeValueAsString(Map.of("stateField", stateField, "action", action));
        调用("POST", "/api/courses/" + courseId + "/transitions", body);
    }

    private void 挂课件(long courseId, String fileName) throws Exception {
        long attachmentId = 造附件(fileName);
        String body = json.writeValueAsString(Map.of(
                "materialType", CourseEnums.MATERIAL_COURSEWARE,
                "attachmentIds", List.of(attachmentId)));
        调用("POST", "/api/courses/" + courseId + "/materials", body);
    }

    /** 自检不是门禁（CK3），这里勾一条只为让快照里有内容可比对（CK4）。 */
    private void 勾一条自检(long courseId) throws Exception {
        long itemId = jdbc.queryForObject("""
                SELECT MIN(id) FROM cfg_selfcheck_item WHERE enabled = TRUE AND deleted = FALSE
                """, Long.class);
        String body = json.writeValueAsString(Map.of("answers", List.of(
                Map.of("itemId", itemId, "checked", true, "note", "已按清单核对"))));
        调用("PUT", "/api/courses/" + courseId + "/selfcheck", body);
    }

    private void 录评审结论(long reviewId, String result) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "reviewForms", List.of("线下会议"),
                "reviewDate", LocalDate.now().toString(),
                "participants", "张三、李四、王五",
                "reviewResult", result,
                "reviewOpinion", "内容完整"));
        调用("POST", "/api/course-reviews/" + reviewId + "/conclusion", body);
    }

    private long 建试讲(long courseId, long lecturerId) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "trialDate", LocalDate.now().toString(),
                "lecturerId", lecturerId,
                "participants", "张三、李四"));
        return 数据(调用("POST", "/api/courses/" + courseId + "/trials", body)).asLong();
    }

    private void 录试讲结论(long trialId) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "acceptanceChecks", List.of("内容易理解"),
                "courseConclusion", CourseEnums.CONCLUSION_QUALIFIED,
                "lecturerConclusion", CourseEnums.CONCLUSION_QUALIFIED,
                "expertOpinion", "达到验收要求"));
        调用("POST", "/api/course-trials/" + trialId + "/conclusion", body);
    }

    private String 主状态(long courseId) throws Exception {
        return 数据(调用("GET", "/api/courses/" + courseId, null)).get("mainState").asText();
    }

    /** 统一走一遍真实接口，并记下这一行调用记录。 */
    private JsonNode 调用(String method, String path, String body) throws Exception {
        MockHttpServletRequestBuilder builder = switch (method) {
            case "POST" -> post(path);
            case "PUT" -> put(path);
            default -> get(path);
        };
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(body);
        }

        MvcResult result = mvc.perform(as运营(builder)).andReturn();
        JsonNode response = json.readTree(响应体(result));
        // 动作码单列一栏：一串 POST /transitions 看不出这一步做的是什么，而这份记录是给人读的
        String action = body == null ? "" : json.readTree(body).path("action").asText("");
        callLog.add("%-4s %-44s %-28s → %s".formatted(
                method, path, action, response.get("code").asText()));

        assertThat(response.get("code").asText())
                .describedAs("%s %s 失败：%s", method, path, response.get("message"))
                .isEqualTo("OK");
        return response;
    }

    private JsonNode 数据(JsonNode response) {
        return response.get("data");
    }

    /**
     * MockMvc 默认按 ISO-8859-1 解码响应体，中文状态值会变成乱码，断言随之全部失败。
     * 真实浏览器读的是响应头里的 UTF-8，这里显式对齐。
     */
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

    private long 造附件(String fileName) {
        return jdbc.queryForObject("""
                INSERT INTO sys_attachment (file_name, file_size, content_type, storage_path, created_by)
                VALUES (?, 2048, 'application/octet-stream', ?, 'operator')
                RETURNING id
                """, Long.class, fileName, "attachment/course/e2e/" + System.nanoTime());
    }

    private String 造人员(String name) {
        String no = "E" + System.nanoTime() % 100000000L;
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, '客服中心', '讲师', '在职', 'operator')
                """, no, name);
        return no;
    }

    private long 造讲师(String name) {
        // JSFIX 前缀不匹配 LecturerMapper 取号用的 ^JS[0-9]+$，夹具因此不会挤占真实讲师编号
        String no = "JSFIX" + System.nanoTime() % 100000000L;
        return jdbc.queryForObject("""
                INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                                          expertise_domains, teaching_direction, join_type,
                                          joined_date, training_state, pool_state, created_by)
                VALUES (?, ?, ?, '客服中心', '["客服"]'::jsonb, 'AI 应用', '运营手动添加',
                        CURRENT_DATE, '可上岗', '在池', 'operator')
                RETURNING id
                """, Long.class, no, name, 造人员(name));
    }
}
