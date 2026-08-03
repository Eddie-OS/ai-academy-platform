package com.aiacademy.app.training;

import com.aiacademy.app.dataimport.ImportFile;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.common.security.AccountType;
import com.aiacademy.platform.dataimport.ImportHandler;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * 培训主线的端到端接口测试（阶段 2 C-5 批，出口准则 E2-1）。
 *
 * <p><b>与 C-1～C-3 五个测试类的分工</b>：那五类走 Service 钉单条规则，这一类走 HTTP 钉「串起来
 * 还能用」。培训这条线上串起来才暴露的问题有三类：
 *
 * <ul>
 *   <li><b>签到从导入中心进来，不从页面进来。</b>页面侧的名单维护与导入侧的签到写入是两个模块，
 *       各自的测试都绿，但「导入的场次ID对不上页面上的场次」这类问题只有把两侧接起来才看得见；
 *   <li><b>两级状态各自手动流转。</b>计划状态不会随场次自动推进（纪律 C1），端到端跑一遍才能确认
 *       两条流转日志各记各的，没有谁替谁写了一笔；
 *   <li><b>归档完成标记不是归档动作的前置条件。</b>需求 11.6 的措辞是「置是后场次可转已归档」，
 *       但 C2 禁止状态变更做业务前置校验——这条冲突的处理方式必须由一条端到端断言钉住。
 * </ul>
 *
 * <p>正向流程的每一步打印成一行接口调用记录，人工验收直接贴进报告。
 */
@AutoConfigureMockMvc
class TrainingLifecycleApiIntegrationTest extends TrainingTestBase {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private List<ImportHandler> handlers;

    private final List<String> callLog = new ArrayList<>();

    // -------------------------------------------------------------------------
    // E2-1 端到端主流程
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-1：建计划 → 排场次 → 开课 → 结束 → 签到导入 → 归档 → 反馈导入 → 计划完成 全程走通")
    void 培训主流程从建计划走到计划完成() throws Exception {
        long courseId = 造课程("端到端培训课");
        long lecturerId = 造讲师("端到端讲师", "可上岗");
        String 到场学员 = 造人员("到场的人", "客服中心");
        String 名单外学员 = 造人员("名单外的人", "客服中心");

        long planId = 建计划(courseId);
        JsonNode plan = 计划(planId);
        assertThat(plan.get("planNo").asText())
                .describedAs("需求 11.3 第 1 项：计划号是 JH + 年月 + 3 位流水")
                .matches("JH\\d{6}\\d{3}");
        assertThat(plan.get("planState").asText()).isEqualTo("待执行");

        long sessionId = 排场次(planId, courseId, lecturerId);
        JsonNode session = 场次(sessionId);
        assertThat(session.get("sessionNo").asText())
                .describedAs("需求 11.4 第 1 项：场次号是「计划号-序号」，签到导入模板以它为关联键")
                .isEqualTo(plan.get("planNo").asText() + "-01");
        assertThat(session.get("durationHours").asDouble())
                .describedAs("需求 11.4 第 8 项：时长由起止时间算出来，运营不必自己填")
                .isEqualTo(3.0);
        assertThat(计划(planId).get("actualSessionCount").asInt())
                .describedAs("实际场次数是 COUNT 出来的，不落库")
                .isEqualTo(1);

        // 两级状态各自手动流转：排了场次不会把计划自动推到「执行中」（纪律 C1）
        assertThat(计划(planId).get("planState").asText()).isEqualTo("待执行");
        转换("training-plans", planId, TrainingStateMachines.FIELD_PLAN_STATE, "FIRST_SESSION_STARTED");

        转换("training-sessions", sessionId, TrainingStateMachines.FIELD_SESSION_STATE, "START");
        加参训人员(sessionId, 到场学员);
        转换("training-sessions", sessionId, TrainingStateMachines.FIELD_SESSION_STATE, "FINISH");

        // 签到从导入中心进来（业务确认项 6），页面上没有新增签到的接口
        String sessionNo = session.get("sessionNo").asText();
        导入(ImportType.ATTENDANCE, "签到.xlsx", List.of(
                List.of(sessionNo, 到场学员, "到场的人", TrainingEnums.ATTEND_PRESENT, "", "现场签到"),
                List.of(sessionNo, 名单外学员, "名单外的人", TrainingEnums.ATTEND_PRESENT, "", "临时来的")));

        JsonNode board = 数据(调用("GET", "/api/training-sessions/" + sessionId + "/attendees", null));
        assertThat(board.get("total").asInt())
                .describedAs("验收 A8-6：签到里出现名单上没有的人时自动补进名单，而不是丢掉这条签到")
                .isEqualTo(2);
        assertThat(board.get("present").asInt()).isEqualTo(2);
        assertThat(board.get("noRecord").asInt()).isZero();
        assertThat(场次(sessionId).get("actualAttendeeCount").asInt())
                .describedAs("需求 11.4 第 14 项：实际签到人数取签到表的已签到条数")
                .isEqualTo(2);

        long attendanceId = board.get("rows").get(0).get("attendanceId").asLong();
        调用("PUT", "/api/training-sessions/" + sessionId + "/attendances/" + attendanceId,
                json.writeValueAsString(Map.of(
                        "attendStatus", TrainingEnums.ATTEND_ABSENT, "remark", "核对后改判未到")));
        assertThat(场次(sessionId).get("actualAttendeeCount").asInt())
                .describedAs("需求 11.5.3 单条修改要即时反映到实际签到人数上")
                .isEqualTo(1);

        调用("PUT", "/api/training-sessions/" + sessionId + "/archive",
                json.writeValueAsString(Map.of(
                        "liveLink", "https://live.example.com/s/1",
                        "videoLink", "https://video.example.com/v/1",
                        "minutesText", "全程 3 小时，实操环节反响好",
                        "archiveCompleted", true)));
        JsonNode archive = 数据(调用("GET", "/api/training-sessions/" + sessionId + "/archive", null));
        assertThat(archive.get("archiveCompleted").asBoolean()).isTrue();
        assertThat(archive.get("completedAt").isNull())
                .describedAs("勾上归档完成要落时间戳，否则「什么时候收齐的」无从查起")
                .isFalse();

        转换("training-sessions", sessionId, TrainingStateMachines.FIELD_SESSION_STATE, "ARCHIVE");
        assertThat(场次(sessionId).get("sessionState").asText())
                .isEqualTo(TrainingStateMachines.SESSION_ARCHIVED);

        // 反馈同样只从导入进来（规则 FB2），且支持匿名（E1-7）
        导入(ImportType.TRAINING_FEEDBACK, "反馈.xlsx", List.of(
                List.of(sessionNo, 到场学员, "5", "实操讲得细"),
                List.of(sessionNo, "", "4", "希望多给点练习时间")));

        JsonNode summary = 数据(调用("GET",
                "/api/training-sessions/" + sessionId + "/feedbacks/summary", null));
        assertThat(summary.get("total").asInt()).isEqualTo(2);
        assertThat(summary.get("averageScore").asDouble()).isEqualTo(4.5);
        assertThat(summary.get("anonymousCount").asInt())
                .describedAs("E1-7：工号留空即匿名，汇总区要把匿名条数单列出来")
                .isEqualTo(1);

        JsonNode feedbacks = 数据(调用("GET",
                "/api/training-sessions/" + sessionId + "/feedbacks?pageNum=1&pageSize=20", null));
        long feedbackId = feedbacks.get("records").get(0).get("id").asLong();
        调用("PUT", "/api/training-sessions/" + sessionId + "/feedbacks/" + feedbackId + "/ops-remark",
                json.writeValueAsString(Map.of("opsRemark", "已同步给讲师")));

        转换("training-plans", planId, TrainingStateMachines.FIELD_PLAN_STATE, "ALL_SESSIONS_FINISHED");
        JsonNode finished = 计划(planId);
        assertThat(finished.get("planState").asText()).isEqualTo("已完成");
        assertThat(finished.get("actualFinishDate").asText())
                .describedAs("需求 11.3 第 12 项：实际完成时间是培训计划按时完成率的判定依据")
                .isEqualTo(LocalDate.now().toString());

        assertThat(状态序列("training-plans", planId, TrainingStateMachines.FIELD_PLAN_STATE))
                .describedAs("需求 5.7 的计划状态主线")
                .containsExactly("已完成", "执行中", "待执行");
        assertThat(状态序列("training-sessions", sessionId, TrainingStateMachines.FIELD_SESSION_STATE))
                .describedAs("需求 5.8 的场次状态主线。两级状态各记各的，没有谁替谁写了一笔")
                .containsExactly("已归档", "已结束", "已开课", "待开课");

        System.out.println("=== E2-1 培训主流程接口调用记录 ===");
        callLog.forEach(System.out::println);
    }

    @Test
    @DisplayName("C2：归档完成标记没勾也能转「已归档」——状态变更不做业务前置校验")
    void 归档标记不是归档动作的前置条件() throws Exception {
        long sessionId = 造场次("没勾归档标记");
        转换("training-sessions", sessionId, TrainingStateMachines.FIELD_SESSION_STATE, "START");
        转换("training-sessions", sessionId, TrainingStateMachines.FIELD_SESSION_STATE, "FINISH");

        转换("training-sessions", sessionId, TrainingStateMachines.FIELD_SESSION_STATE, "ARCHIVE");

        assertThat(场次(sessionId).get("sessionState").asText())
                .describedAs("需求 11.6 写的是「置是后场次可转已归档」，但 C2 禁止状态变更做业务前置"
                        + "校验：拦住它等于拦住运营补录历史场次，而那批场次的材料本来就收不齐了")
                .isEqualTo(TrainingStateMachines.SESSION_ARCHIVED);
    }

    @Test
    @DisplayName("C3：场次跳过「已开课」直接归档被硬阻断在服务层，且不留下任何痕迹")
    void 非法转换硬阻断() throws Exception {
        long sessionId = 造场次("跳步归档");

        MvcResult result = mvc.perform(as运营(post("/api/training-sessions/{id}/transitions", sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "stateField", TrainingStateMachines.FIELD_SESSION_STATE,
                        "action", "ARCHIVE"))))).andReturn();

        JsonNode response = json.readTree(响应体(result));
        assertThat(response.get("code").asText()).isEqualTo("ILLEGAL_TRANSITION");
        assertThat(response.get("message").asText())
                .describedAs("开发 7.2：message 必须是能直接展示给运营的中文")
                .contains("待开课");
        assertThat(场次(sessionId).get("sessionState").asText()).isEqualTo("待开课");
        assertThat(数据(调用("GET", "/api/training-sessions/" + sessionId + "/state-logs", null)).size())
                .describedAs("被拒的转换只有创建那一条日志")
                .isEqualTo(1);
    }

    // -------------------------------------------------------------------------
    // E2-3 权限矩阵在培训页面上的落点
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-3／PM1：用户账号读得到培训的每一处，写一律 403 且不留痕迹")
    void 用户账号只读() throws Exception {
        long sessionId = 造场次("只读验证");
        long planId = 场次(sessionId).get("planId").asLong();

        for (String path : List.of("/api/training-plans", "/api/training-plans/" + planId,
                "/api/training-sessions", "/api/training-sessions/" + sessionId,
                "/api/training-sessions/" + sessionId + "/attendees",
                "/api/training-sessions/" + sessionId + "/archive",
                "/api/training-sessions/" + sessionId + "/feedbacks",
                "/api/training-sessions/" + sessionId + "/feedbacks/summary",
                "/api/training-sessions/" + sessionId + "/transitions/available",
                "/api/training-sessions/" + sessionId + "/state-logs")) {
            MvcResult result = mvc.perform(as查看(get(path))).andReturn();
            assertThat(json.readTree(响应体(result)).get("code").asText())
                    .describedAs("PMI-2：读接口对两个账号无差别，%s 也不例外", path)
                    .isEqualTo("OK");
        }

        // 培训侧的写接口有四类形态。漏给其中一类加 @WriteApi 不会有任何报错，
        // 只有针对那一类的请求会静悄悄地通过
        Map<String, MockHttpServletRequestBuilder> writes = new HashMap<>();
        writes.put("统一转换", post("/api/training-sessions/{id}/transitions", sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "stateField", TrainingStateMachines.FIELD_SESSION_STATE, "action", "START"))));
        writes.put("对象表单", delete("/api/training-plans/{id}", planId));
        writes.put("名单维护", post("/api/training-sessions/{id}/attendees", sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("employeeNos", List.of(ownerNo)))));
        writes.put("页签表单", put("/api/training-sessions/{id}/archive", sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("archiveCompleted", true))));

        for (Map.Entry<String, MockHttpServletRequestBuilder> entry : writes.entrySet()) {
            MvcResult result = mvc.perform(as查看(entry.getValue())).andReturn();
            assertThat(json.readTree(响应体(result)).get("code").asText())
                    .describedAs("%s 类写接口未被拒绝", entry.getKey())
                    .isEqualTo("FORBIDDEN");
        }

        assertThat(场次(sessionId).get("sessionState").asText())
                .describedAs("被拒的写请求不能留下任何痕迹")
                .isEqualTo("待开课");
        assertThat(数据(调用("GET", "/api/training-sessions/" + sessionId + "/attendees", null))
                .get("total").asInt()).isZero();
    }

    // -------------------------------------------------------------------------
    // E2-4 列表筛选与分页
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E2-4：计划列表按 pageNum 从 1 起分页，第二页不重复第一页，状态筛选走 plan_state 列")
    void 计划列表分页与筛选() throws Exception {
        long courseId = 造课程("分页用课");
        for (int i = 0; i < 4; i++) {
            建计划(courseId);
        }
        long running = 建计划(courseId);
        转换("training-plans", running, TrainingStateMachines.FIELD_PLAN_STATE, "FIRST_SESSION_STARTED");

        String base = "/api/training-plans?ownerNo=" + ownerNo;
        JsonNode page1 = 数据(调用("GET", base + "&pageNum=1&pageSize=3", null));
        JsonNode page2 = 数据(调用("GET", base + "&pageNum=2&pageSize=3", null));

        assertThat(page1.get("total").asInt()).isEqualTo(5);
        assertThat(page1.get("records").size()).isEqualTo(3);
        assertThat(page2.get("records").size()).isEqualTo(2);

        List<Long> ids = new ArrayList<>();
        page1.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        page2.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        assertThat(ids)
                .describedAs("第二页重复第一页，是 offset 按 pageNum 而不是 pageNum-1 算的典型症状")
                .doesNotHaveDuplicates();

        // 状态值是中文，用 param() 而不是拼进查询串：拼串编错时的症状与「筛选条件没接上 SQL」一样
        MvcResult filtered = mvc.perform(as运营(get("/api/training-plans")
                .param("ownerNo", ownerNo)
                .param("planState", "执行中"))).andReturn();
        JsonNode byState = json.readTree(响应体(filtered)).get("data");
        assertThat(byState.get("total").asInt()).isEqualTo(1);
        assertThat(byState.get("records").get(0).get("id").asLong()).isEqualTo(running);
    }

    @Test
    @DisplayName("E2-4／11.8：日历按日期区间取数，区间外的场次不返回")
    void 场次按日期区间取数() throws Exception {
        long courseId = 造课程("日历用课");
        long lecturerId = 造讲师("日历讲师", "可上岗");
        long planId = 建计划(courseId);
        long 本月 = 排场次(planId, courseId, lecturerId, LocalDate.now().plusDays(3));
        long 下月 = 排场次(planId, courseId, lecturerId, LocalDate.now().plusDays(45));

        JsonNode page = 数据(调用("GET", "/api/training-sessions?planId=" + planId
                + "&dateFrom=" + LocalDate.now()
                + "&dateTo=" + LocalDate.now().plusDays(30)
                + "&pageSize=200", null));

        List<Long> ids = new ArrayList<>();
        page.get("records").forEach(row -> ids.add(row.get("id").asLong()));
        assertThat(ids).contains(本月).doesNotContain(下月);
    }

    // -------------------------------------------------------------------------
    // 夹具：每一步都走真实 HTTP 接口
    // -------------------------------------------------------------------------

    private long 建计划(long courseId) throws Exception {
        String body = json.writeValueAsString(Map.of(
                "planName", "端到端培训计划" + System.nanoTime(),
                "courseId", courseId,
                "ownerNo", ownerNo,
                "targetScope", "MSS 三层部门全体",
                "planStartDate", LocalDate.now().toString(),
                "planEndDate", LocalDate.now().plusDays(30).toString(),
                "planSessionCount", 1,
                "remark", "端到端主流程验证用"));
        return 数据(调用("POST", "/api/training-plans", body)).asLong();
    }

    private long 排场次(long planId, long courseId, long lecturerId) throws Exception {
        return 排场次(planId, courseId, lecturerId, LocalDate.now().plusDays(7));
    }

    private long 排场次(long planId, long courseId, long lecturerId, LocalDate date) throws Exception {
        Map<String, Object> form = new HashMap<>();
        form.put("sessionName", "第一场");
        form.put("courseId", courseId);
        form.put("lecturerId", lecturerId);
        form.put("trainingDate", date.toString());
        form.put("startTime", "09:00:00");
        form.put("endTime", "12:00:00");
        form.put("trainingForm", TrainingEnums.FORM_OFFLINE);
        form.put("venue", "3 楼报告厅");
        form.put("studentScope", "全体客服");
        form.put("planAttendeeCount", 30);

        JsonNode saved = 数据(调用("POST", "/api/training-plans/" + planId + "/sessions",
                json.writeValueAsString(form)));
        assertThat(saved.get("warnings").size())
                .describedAs("排课三项校验里只有讲师时段冲突与课程过期是提示，本条夹具两项都不该触发")
                .isZero();
        return saved.get("id").asLong();
    }

    private void 加参训人员(long sessionId, String employeeNo) throws Exception {
        调用("POST", "/api/training-sessions/" + sessionId + "/attendees",
                json.writeValueAsString(Map.of("employeeNos", List.of(employeeNo))));
    }

    /** 走导入中心的三步向导：上传 → 确认。签到与反馈都只有这一条录入通道。 */
    private void 导入(ImportType type, String fileName, List<List<String>> rows) throws Exception {
        byte[] file = ImportFile.of(handlers.stream()
                .filter(handler -> handler.type() == type)
                .findFirst().orElseThrow().template(), rows);
        // 规则 API-1：路径段用小写连字符，枚举名带下划线
        String urlName = type.name().toLowerCase(java.util.Locale.ROOT).replace('_', '-');

        MvcResult uploaded = mvc.perform(as运营(
                multipart("/api/imports/{type}/uploads", urlName)
                        .file(new MockMultipartFile("file", fileName, null, file)))).andReturn();
        JsonNode preview = json.readTree(响应体(uploaded)).get("data");
        assertThat(preview.get("canConfirm").asBoolean())
                .describedAs("导入校验未通过：%s", preview.get("errors"))
                .isTrue();

        String batchNo = preview.get("batchNo").asText();
        callLog.add("%-4s %-52s %-20s → %s".formatted(
                "POST", "/api/imports/" + urlName + "/uploads", type.label(), "OK"));
        调用("POST", "/api/imports/" + batchNo + "/confirmation", null);
    }

    private void 转换(String segment, long id, String stateField, String action) throws Exception {
        String body = json.writeValueAsString(Map.of("stateField", stateField, "action", action));
        调用("POST", "/api/" + segment + "/" + id + "/transitions", body);
    }

    private JsonNode 计划(long planId) throws Exception {
        return 数据(调用("GET", "/api/training-plans/" + planId, null));
    }

    private JsonNode 场次(long sessionId) throws Exception {
        return 数据(调用("GET", "/api/training-sessions/" + sessionId, null));
    }

    /** 该状态字段的流转日志（倒序）里到达过的状态序列。 */
    private List<String> 状态序列(String segment, long id, String stateField) throws Exception {
        List<String> states = new ArrayList<>();
        数据(调用("GET", "/api/" + segment + "/" + id + "/state-logs", null)).forEach(row -> {
            if (stateField.equals(row.get("stateField").asText())) {
                states.add(row.get("toState").asText());
            }
        });
        return states;
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
        callLog.add("%-4s %-52s %-20s → %s".formatted(
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
}
