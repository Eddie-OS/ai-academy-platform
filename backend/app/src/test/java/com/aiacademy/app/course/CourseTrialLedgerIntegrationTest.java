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
 * 课程详情「试讲」页台账：基础信息、排期、反馈、结论走独立保存接口，不改五个状态列。
 */
@AutoConfigureMockMvc
class CourseTrialLedgerIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("保存试讲台账再 GET 回填；子状态与主状态不动")
    void 保存试讲台账不改状态() throws Exception {
        String ownerNo = 造人员("试讲页负责人");
        String lecturerNo = 造人员("试讲授课讲师");
        long courseId = 立项(ownerNo);
        JsonNode before = 数据(调用("GET", "/api/courses/" + courseId, null));

        Map<String, Object> form = 试讲表单(before.get("version").asInt(), ownerNo, lecturerNo);
        调用("PUT", "/api/courses/" + courseId + "/trial-ledger", json.writeValueAsString(form));

        JsonNode after = 数据(调用("GET", "/api/courses/" + courseId, null));
        assertThat(after.get("ownerNo").asText()).isEqualTo(ownerNo);
        assertThat(after.get("trialLecturerNo").asText()).isEqualTo(lecturerNo);
        assertThat(after.get("trialCurrentPhase").asText()).isEqualTo("SCHEDULED");
        assertThat(after.get("trialLedgerStatus").asText()).isEqualTo("IN_PROGRESS");
        assertThat(after.get("trialRoundLabel").asText()).isEqualTo("第 1 轮");
        assertThat(after.get("trialScheduledDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(after.get("trialAudienceGroup").asText()).isEqualTo("一线客服");
        assertThat(after.get("trialAudienceCount").asText()).isEqualTo("20");
        assertThat(after.get("trialHours").decimalValue()).isEqualByComparingTo("2.0");
        assertThat(after.get("trialFormat").asText()).isEqualTo("OFFLINE");
        assertThat(after.get("trialSatisfaction").asText()).contains("满意");
        assertThat(after.get("trialOptimizeAdvice").asText()).contains("加案例");
        assertThat(after.get("trialAcceptanceResult").asText()).isEqualTo("PASS");
        assertThat(after.get("trialReadyToPublish").asText()).isEqualTo("否");
        assertThat(after.get("trialLecturerQualified").asText()).isEqualTo("是");
        assertThat(after.get("trialConclusionDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(after.get("trialRemark").asText()).contains("上线");
        assertThat(after.get("trialState").isNull()).isTrue();
        assertThat(after.get("mainState").asText()).isEqualTo("立项");
        assertThat(after.get("lastStateChangedAt").asText())
                .isEqualTo(before.get("lastStateChangedAt").asText());
        assertThat(after.get("version").asInt()).isEqualTo(before.get("version").asInt() + 1);
    }

    @Test
    @DisplayName("K1：试讲页保存也走乐观锁")
    void 版本过期冲突() throws Exception {
        String ownerNo = 造人员("乐观锁");
        long courseId = 立项(ownerNo);
        int stale = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        调用("PUT", "/api/courses/" + courseId + "/trial-ledger",
                json.writeValueAsString(试讲表单(stale, ownerNo, ownerNo)));

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/trial-ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(试讲表单(stale, ownerNo, ownerNo)))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("CONCURRENT_MODIFIED");
        assertThat(response.get("message").asText()).contains("已被他人修改");
    }

    @Test
    @DisplayName("PM1：用户账号读得到试讲字段，写被拒")
    void 用户账号只读() throws Exception {
        String ownerNo = 造人员("只读");
        long courseId = 立项(ownerNo);
        JsonNode read = json.readTree(响应体(mvc.perform(as查看(get("/api/courses/" + courseId))).andReturn()));
        assertThat(read.get("code").asText()).isEqualTo("OK");
        assertThat(read.get("data").get("courseNo").asText()).startsWith("KC");

        JsonNode write = json.readTree(响应体(mvc.perform(as查看(
                        put("/api/courses/" + courseId + "/trial-ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(试讲表单(0, ownerNo, ownerNo)))))
                .andReturn()));
        assertThat(write.get("code").asText()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("试讲验收结果不在字典里时 PARAM_INVALID")
    void 非法验收码被拒() throws Exception {
        long courseId = 立项(造人员("非法验收"));
        int version = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        Map<String, Object> form = 试讲表单(version, "E0", "E0");
        form.put("trialAcceptanceResult", "NOT_A_CODE");

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/trial-ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(form))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("PARAM_INVALID");
    }

    @Test
    @DisplayName("试讲日历只列试讲：台账预定日出现，文案字段齐全")
    void 试讲日历含台账预定() throws Exception {
        String ownerNo = 造人员("日历负责人");
        String lecturerNo = 造人员("日历讲师");
        long courseId = 立项(ownerNo);
        JsonNode course = 数据(调用("GET", "/api/courses/" + courseId, null));
        调用("PUT", "/api/courses/" + courseId + "/trial-ledger",
                json.writeValueAsString(试讲表单(course.get("version").asInt(), ownerNo, lecturerNo)));

        LocalDate today = LocalDate.now();
        JsonNode items = 数据(调用("GET",
                "/api/course-trials/calendar?from=" + today + "&to=" + today, null));
        JsonNode hit = null;
        for (JsonNode item : items) {
            if (item.get("courseId").asLong() == courseId) {
                hit = item;
                break;
            }
        }
        assertThat(hit).isNotNull();
        assertThat(hit.get("trialDate").asText()).isEqualTo(today.toString());
        assertThat(hit.get("courseName").asText()).isEqualTo(course.get("courseName").asText());
        assertThat(hit.get("roundLabel").asText()).isEqualTo("第 1 轮");
        assertThat(hit.get("lecturerName").asText()).isEqualTo("日历讲师");
        assertThat(hit.get("audienceCount").asText()).isEqualTo("20");
    }

    @Test
    @DisplayName("元数据下发试讲阶段、台账状态、形式、验收结果与是否枚举")
    void 字典与枚举下发() throws Exception {
        JsonNode dicts = 数据(调用("GET", "/api/meta/dicts", null));
        assertThat(dicts.get("课程试讲阶段").findValuesAsText("code"))
                .containsExactly("PENDING_SCHEDULE", "SCHEDULED", "DONE");
        assertThat(dicts.get("课程试讲台账状态").findValuesAsText("code"))
                .containsExactly("PENDING", "IN_PROGRESS", "DONE", "PUBLISHED");
        assertThat(dicts.get("课程试讲形式").findValuesAsText("code"))
                .containsExactly("OFFLINE", "LIVE", "RECORDED");
        assertThat(dicts.get("试讲验收结果").findValuesAsText("code"))
                .containsExactly("PASS", "FAIL");
        assertThat(dicts.get("试讲验收结果").findValuesAsText("name"))
                .containsExactly("试讲通过", "试讲不通过");

        JsonNode flags = 数据(调用("GET", "/api/meta/field-enums", null));
        assertThat(flags.get("课程是否满足发布要求").get(0).asText()).isEqualTo("是");
        assertThat(flags.get("课程是否满足发布要求").get(1).asText()).isEqualTo("否");
        assertThat(flags.get("讲师试讲是否合格").get(0).asText()).isEqualTo("是");
        assertThat(flags.get("讲师试讲是否合格").get(1).asText()).isEqualTo("否");
    }

    private Map<String, Object> 试讲表单(int version, String ownerNo, String lecturerNo) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("ownerNo", ownerNo);
        form.put("trialLecturerNo", lecturerNo);
        form.put("trialCurrentPhase", "SCHEDULED");
        form.put("trialLedgerStatus", "IN_PROGRESS");
        form.put("trialRoundLabel", "第 1 轮");
        form.put("trialScheduledDate", LocalDate.now().toString());
        form.put("trialAudienceGroup", "一线客服");
        form.put("trialAudienceCount", "20");
        form.put("trialHours", "2.0");
        form.put("trialFormat", "OFFLINE");
        form.put("trialSatisfaction", "整体满意");
        form.put("trialOptimizeAdvice", "加案例");
        form.put("trialAcceptanceResult", "PASS");
        form.put("trialReadyToPublish", "否");
        form.put("trialLecturerQualified", "是");
        form.put("trialConclusionDate", LocalDate.now().toString());
        form.put("trialRemark", "后续上线注意节奏");
        form.put("version", version);
        return form;
    }

    private long 立项(String ownerNo) throws Exception {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("courseName", "试讲页课程" + System.nanoTime());
        form.put("reviewTrack", CourseEnums.TRACK_INTERNAL);
        form.put("domainCode", "COURSE");
        form.put("ownerNo", ownerNo);
        form.put("initiatedDate", LocalDate.now().toString());
        form.put("expectPublishDate", LocalDate.now().plusDays(30).toString());
        form.put("summary", "试讲页保存验证");
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
