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
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * 课程详情「评审」页台账：基础信息与初步评审走独立保存接口，不改主状态与评审记录状态。
 */
@AutoConfigureMockMvc
class CourseReviewLedgerIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("保存评审台账再 GET 回填；主状态与评审记录状态不动")
    void 保存评审台账不改状态() throws Exception {
        String ownerNo = 造人员("评审页负责人");
        long courseId = 立项(ownerNo);
        JsonNode before = 数据(调用("GET", "/api/courses/" + courseId, null));

        Map<String, Object> form = 评审表单(before.get("version").asInt(), ownerNo);
        调用("PUT", "/api/courses/" + courseId + "/review-ledger", json.writeValueAsString(form));

        JsonNode after = 数据(调用("GET", "/api/courses/" + courseId, null));
        assertThat(after.get("ownerNo").asText()).isEqualTo(ownerNo);
        assertThat(after.get("reviewRoundLabel").asText()).isEqualTo("第 1 轮");
        assertThat(after.get("reviewCompletedDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(after.get("reviewLedgerPhase").asText()).isEqualTo("IN_PRELIM");
        assertThat(after.get("reviewLedgerStatus").asText()).isEqualTo("IN_PROGRESS");
        assertThat(after.get("enterTrial").asText()).isEqualTo("否");
        assertThat(after.get("prelimRoundLabel").asText()).isEqualTo("第 1 轮");
        assertThat(after.get("prelimReviewers").asText()).isEqualTo("张三、李四");
        assertThat(after.get("prelimReviewDate").asText()).isEqualTo(LocalDate.now().minusDays(1).toString());
        assertThat(after.get("prelimCompletedDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(after.get("prelimConclusion").asText()).isEqualTo("PASS");
        assertThat(after.get("prelimOpinion").asText()).contains("结构完整");
        assertThat(after.get("enterMeeting").asText()).isEqualTo("是");
        assertThat(after.get("meetingRoundLabel").asText()).isEqualTo("第 2 轮");
        assertThat(after.get("meetingReviewers").asText()).isEqualTo("王五");
        assertThat(after.get("meetingActualDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(after.get("meetingConclusion").asText()).isEqualTo("PASS");
        assertThat(after.get("meetingOpinion").asText()).contains("顶层");
        assertThat(after.get("mainState").asText()).isEqualTo("立项");
        assertThat(after.get("reviewRecordState").isNull()).isTrue();
        assertThat(after.get("lastStateChangedAt").asText())
                .isEqualTo(before.get("lastStateChangedAt").asText());
        assertThat(after.get("version").asInt()).isEqualTo(before.get("version").asInt() + 1);
    }

    @Test
    @DisplayName("K1：评审页保存也走乐观锁")
    void 版本过期冲突() throws Exception {
        String ownerNo = 造人员("乐观锁");
        long courseId = 立项(ownerNo);
        int stale = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        调用("PUT", "/api/courses/" + courseId + "/review-ledger",
                json.writeValueAsString(评审表单(stale, ownerNo)));

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/review-ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(评审表单(stale, ownerNo)))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("CONCURRENT_MODIFIED");
        assertThat(response.get("message").asText()).contains("已被他人修改");
    }

    @Test
    @DisplayName("PM1：用户账号读得到评审台账，写被拒")
    void 用户账号只读() throws Exception {
        String ownerNo = 造人员("只读");
        long courseId = 立项(ownerNo);
        JsonNode read = json.readTree(响应体(mvc.perform(as查看(get("/api/courses/" + courseId))).andReturn()));
        assertThat(read.get("code").asText()).isEqualTo("OK");
        assertThat(read.get("data").get("courseNo").asText()).startsWith("KC");

        JsonNode write = json.readTree(响应体(mvc.perform(as查看(
                        put("/api/courses/" + courseId + "/review-ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(评审表单(0, ownerNo)))))
                .andReturn()));
        assertThat(write.get("code").asText()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("评审阶段不在字典里时 PARAM_INVALID")
    void 非法阶段码被拒() throws Exception {
        long courseId = 立项(造人员("非法阶段"));
        int version = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        Map<String, Object> form = 评审表单(version, "E0");
        form.put("reviewLedgerPhase", "NOT_A_CODE");

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/review-ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(form))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("PARAM_INVALID");
    }

    @Test
    @DisplayName("元数据下发评审阶段、台账状态、初审结论与轮数")
    void 字典与枚举下发() throws Exception {
        JsonNode dicts = 数据(调用("GET", "/api/meta/dicts", null));
        assertThat(dicts.get("课程评审阶段").findValuesAsText("code"))
                .containsExactly("PENDING_PRELIM", "IN_PRELIM", "PENDING_MEETING",
                        "IN_MEETING", "OPTIMIZING", "IN_REREVIEW", "DONE");
        assertThat(dicts.get("课程评审台账状态").findValuesAsText("code"))
                .containsExactly("PENDING", "IN_PROGRESS", "DONE");
        assertThat(dicts.get("初步评审结论").findValuesAsText("code"))
                .containsExactly("PASS", "FAIL");
        assertThat(dicts.get("上会最终结论").findValuesAsText("code"))
                .containsExactly("PASS", "REJECT_REVISE", "REJECT_END");
        assertThat(dicts.get("上会最终结论").findValuesAsText("name"))
                .containsExactly("通过", "不通过·修改后重新评审", "不通过·结束");

        JsonNode flags = 数据(调用("GET", "/api/meta/field-enums", null));
        JsonNode rounds = flags.get("课程评审轮数");
        assertThat(rounds.size()).isEqualTo(5);
        assertThat(rounds.get(0).asText()).isEqualTo("第 1 轮");
        assertThat(rounds.get(4).asText()).isEqualTo("第 5 轮");
        assertThat(flags.get("是否进入试讲环节").get(0).asText()).isEqualTo("是");
        assertThat(flags.get("是否进入试讲环节").get(1).asText()).isEqualTo("否");
        assertThat(flags.get("是否进入上会评审环节").get(0).asText()).isEqualTo("是");
        assertThat(flags.get("是否进入上会评审环节").get(1).asText()).isEqualTo("否");
    }

    private Map<String, Object> 评审表单(int version, String ownerNo) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("ownerNo", ownerNo);
        form.put("reviewRoundLabel", "第 1 轮");
        form.put("reviewCompletedDate", LocalDate.now().toString());
        form.put("reviewLedgerPhase", "IN_PRELIM");
        form.put("reviewLedgerStatus", "IN_PROGRESS");
        form.put("enterTrial", "否");
        form.put("prelimRoundLabel", "第 1 轮");
        form.put("prelimReviewers", "张三、李四");
        form.put("prelimReviewDate", LocalDate.now().minusDays(1).toString());
        form.put("prelimCompletedDate", LocalDate.now().toString());
        form.put("prelimConclusion", "PASS");
        form.put("prelimOpinion", "结构完整，建议补充合规说明");
        form.put("enterMeeting", "是");
        form.put("meetingRoundLabel", "第 2 轮");
        form.put("meetingReviewers", "王五");
        form.put("meetingActualDate", LocalDate.now().toString());
        form.put("meetingConclusion", "PASS");
        form.put("meetingOpinion", "顶层指导意见");
        form.put("version", version);
        return form;
    }

    private long 立项(String ownerNo) throws Exception {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("courseName", "评审页课程" + System.nanoTime());
        form.put("reviewTrack", CourseEnums.TRACK_INTERNAL);
        form.put("domainCode", "COURSE");
        form.put("ownerNo", ownerNo);
        form.put("initiatedDate", LocalDate.now().toString());
        form.put("expectPublishDate", LocalDate.now().plusDays(30).toString());
        form.put("summary", "评审页保存验证");
        form.put("targetAudience", "一线客服");
        form.put("classHours", "4.5");
        form.put("categoryCode", "INDIVIDUAL");
        form.put("validityPeriod", "12 个月");
        return 数据(调用("POST", "/api/courses", json.writeValueAsString(form))).asLong();
    }

    private JsonNode 调用(String method, String path, String body) throws Exception {
        MockHttpServletRequestBuilder builder = switch (method) {
            case "POST" -> post(path);
            case "PUT" -> put(path);
            default -> get(path);
        };
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        JsonNode response = json.readTree(响应体(mvc.perform(as运营(builder)).andReturn()));
        assertThat(response.get("code").asText())
                .describedAs("%s %s 失败：%s", method, path, response.get("message"))
                .isEqualTo("OK");
        return response;
    }

    private JsonNode 数据(JsonNode response) {
        return response.get("data");
    }

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
                VALUES (?, ?, '客服中心', '讲师', '在职', 'operator')
                """, no, name);
        return no;
    }
}
