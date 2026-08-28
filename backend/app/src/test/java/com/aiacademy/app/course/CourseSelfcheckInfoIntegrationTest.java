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
 * 课程详情「自检」页台账：基础信息与规格 8 项走独立保存接口，不改自检子状态。
 */
@AutoConfigureMockMvc
class CourseSelfcheckInfoIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("保存自检台账再 GET 回填；子状态与主状态不动")
    void 保存自检信息不改状态() throws Exception {
        String ownerNo = 造人员("自检页负责人");
        long courseId = 立项(ownerNo);
        JsonNode before = 数据(调用("GET", "/api/courses/" + courseId, null));

        Map<String, Object> form = 自检表单(before.get("version").asInt(), ownerNo);
        调用("PUT", "/api/courses/" + courseId + "/selfcheck-info", json.writeValueAsString(form));

        JsonNode after = 数据(调用("GET", "/api/courses/" + courseId, null));
        assertThat(after.get("selfcheckCheckerNo").asText()).isEqualTo(ownerNo);
        assertThat(after.get("selfcheckCompletedDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(after.get("selfcheckConclusion").asText()).isEqualTo("PASS");
        assertThat(after.get("selfcheckRecordStatus").asText()).isEqualTo("DONE");
        assertThat(after.get("submitExpertReview").asText()).isEqualTo("否");
        assertThat(after.get("selfcheckSpecAnswers").get("GOAL_CLEAR").asText()).isEqualTo("是");
        assertThat(after.get("selfcheckSpecAnswers").get("STRUCTURE").asText()).isEqualTo("否");
        assertThat(after.get("selfcheckState").isNull()).isTrue();
        assertThat(after.get("mainState").asText()).isEqualTo("立项");
        assertThat(after.get("lastStateChangedAt").asText())
                .isEqualTo(before.get("lastStateChangedAt").asText());
        assertThat(after.get("version").asInt()).isEqualTo(before.get("version").asInt() + 1);
    }

    @Test
    @DisplayName("K1：自检页保存也走乐观锁")
    void 版本过期冲突() throws Exception {
        String ownerNo = 造人员("乐观锁");
        long courseId = 立项(ownerNo);
        int stale = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        调用("PUT", "/api/courses/" + courseId + "/selfcheck-info",
                json.writeValueAsString(自检表单(stale, ownerNo)));

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/selfcheck-info")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(自检表单(stale, ownerNo)))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("CONCURRENT_MODIFIED");
        assertThat(response.get("message").asText()).contains("已被他人修改");
    }

    @Test
    @DisplayName("PM1：用户账号读得到自检字段，写被拒")
    void 用户账号只读() throws Exception {
        String ownerNo = 造人员("只读");
        long courseId = 立项(ownerNo);
        JsonNode read = json.readTree(响应体(mvc.perform(as查看(get("/api/courses/" + courseId))).andReturn()));
        assertThat(read.get("code").asText()).isEqualTo("OK");
        assertThat(read.get("data").get("courseNo").asText()).startsWith("KC");

        JsonNode write = json.readTree(响应体(mvc.perform(as查看(
                        put("/api/courses/" + courseId + "/selfcheck-info")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(自检表单(0, ownerNo)))))
                .andReturn()));
        assertThat(write.get("code").asText()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("自检结论不在字典里时 PARAM_INVALID")
    void 非法结论码被拒() throws Exception {
        long courseId = 立项(造人员("非法结论"));
        int version = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        Map<String, Object> form = 自检表单(version, "E0");
        form.put("selfcheckConclusion", "NOT_A_CODE");

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/selfcheck-info")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(form))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("PARAM_INVALID");
    }

    @Test
    @DisplayName("元数据下发自检记录状态与总体结论")
    void 字典下发() throws Exception {
        JsonNode dicts = 数据(调用("GET", "/api/meta/dicts", null));
        assertThat(dicts.get("课程自检记录状态").findValuesAsText("code"))
                .containsExactly("PENDING", "IN_PROGRESS", "DONE");
        assertThat(dicts.get("课程自检结论").findValuesAsText("code"))
                .containsExactly("PASS", "FAIL");

        JsonNode flags = 数据(调用("GET", "/api/meta/field-enums", null));
        assertThat(flags.get("是否提交专家评审").get(0).asText()).isEqualTo("是");
        assertThat(flags.get("是否提交专家评审").get(1).asText()).isEqualTo("否");
        assertThat(flags.get("是否符合要求").get(0).asText()).isEqualTo("是");
        assertThat(flags.get("是否符合要求").get(1).asText()).isEqualTo("否");
    }

    private Map<String, Object> 自检表单(int version, String checkerNo) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("selfcheckCheckerNo", checkerNo);
        form.put("selfcheckCompletedDate", LocalDate.now().toString());
        form.put("selfcheckConclusion", "PASS");
        form.put("selfcheckRecordStatus", "DONE");
        form.put("submitExpertReview", "否");
        form.put("specAnswers", Map.of("GOAL_CLEAR", "是", "STRUCTURE", "否"));
        form.put("version", version);
        return form;
    }

    private long 立项(String ownerNo) throws Exception {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("courseName", "自检页课程" + System.nanoTime());
        form.put("reviewTrack", CourseEnums.TRACK_INTERNAL);
        form.put("domainCode", "COURSE");
        form.put("ownerNo", ownerNo);
        form.put("initiatedDate", LocalDate.now().toString());
        form.put("expectPublishDate", LocalDate.now().plusDays(30).toString());
        form.put("summary", "自检页保存验证");
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
        String no = "E" + System.nanoTime() % 100000000L;
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, '客服中心', '讲师', '在职', 'operator')
                """, no, name);
        return no;
    }
}
