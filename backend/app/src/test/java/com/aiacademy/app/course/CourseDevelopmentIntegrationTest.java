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
 * 课程详情「开发」页：初稿日期与是否进入自检走独立保存，不改开发状态、不写流转日志。
 */
@AutoConfigureMockMvc
class CourseDevelopmentIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("保存开发台账再 GET 回填；主状态、开发状态与停滞时刻不动")
    void 保存开发信息不改状态() throws Exception {
        long courseId = 立项();
        JsonNode before = 数据(调用("GET", "/api/courses/" + courseId, null));
        assertThat(before.get("courseNo").asText()).startsWith("KC");
        assertThat(before.get("initiationNo").asText()).startsWith("LI");
        assertThat(before.get("mainState").asText()).isEqualTo("立项");

        调用("PUT", "/api/courses/" + courseId + "/development",
                json.writeValueAsString(开发表单(before.get("ownerNo").asText(), before.get("version").asInt())));

        JsonNode after = 数据(调用("GET", "/api/courses/" + courseId, null));
        assertThat(after.get("planDraftDate").asText()).isEqualTo(LocalDate.now().plusDays(7).toString());
        assertThat(after.get("actualDraftDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(after.get("enterSelfCheck").asText()).isEqualTo("否");
        assertThat(after.get("ownerNo").asText()).isEqualTo(before.get("ownerNo").asText());
        assertThat(after.get("mainState").asText()).isEqualTo("立项");
        assertThat(after.get("devState").isNull()).isTrue();
        assertThat(after.get("lastStateChangedAt").asText())
                .isEqualTo(before.get("lastStateChangedAt").asText());
        assertThat(after.get("version").asInt()).isEqualTo(before.get("version").asInt() + 1);
    }

    @Test
    @DisplayName("是否进入自检取值非法时 PARAM_INVALID")
    void 非法自检标记被拒() throws Exception {
        long courseId = 立项();
        int version = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        String ownerNo = 数据(调用("GET", "/api/courses/" + courseId, null)).get("ownerNo").asText();
        Map<String, Object> form = 开发表单(ownerNo, version);
        form.put("enterSelfCheck", "也许");

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/development")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(form))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("PARAM_INVALID");
        assertThat(数据(调用("GET", "/api/courses/" + courseId, null)).get("enterSelfCheck").isNull())
                .isTrue();
    }

    @Test
    @DisplayName("K1：开发页保存也走乐观锁")
    void 版本过期冲突() throws Exception {
        long courseId = 立项();
        JsonNode before = 数据(调用("GET", "/api/courses/" + courseId, null));
        int stale = before.get("version").asInt();
        String ownerNo = before.get("ownerNo").asText();
        调用("PUT", "/api/courses/" + courseId + "/development",
                json.writeValueAsString(开发表单(ownerNo, stale)));

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/development")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(开发表单(ownerNo, stale)))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("CONCURRENT_MODIFIED");
        assertThat(response.get("message").asText()).contains("已被他人修改");
    }

    @Test
    @DisplayName("PM1：用户账号读得到开发字段，写被拒")
    void 用户账号只读() throws Exception {
        long courseId = 立项();
        JsonNode read = json.readTree(响应体(mvc.perform(as查看(get("/api/courses/" + courseId))).andReturn()));
        assertThat(read.get("code").asText()).isEqualTo("OK");
        assertThat(read.get("data").get("courseNo").asText()).startsWith("KC");

        JsonNode write = json.readTree(响应体(mvc.perform(as查看(
                        put("/api/courses/" + courseId + "/development")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(开发表单("E0", 0)))))
                .andReturn()));
        assertThat(write.get("code").asText()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("元数据下发是否进入自检，前端不手写选项")
    void 枚举下发() throws Exception {
        JsonNode flags = 数据(调用("GET", "/api/meta/field-enums", null)).get("是否进入课程自检");
        assertThat(flags.get(0).asText()).isEqualTo("是");
        assertThat(flags.get(1).asText()).isEqualTo("否");
    }

    private Map<String, Object> 开发表单(String ownerNo, int version) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("ownerNo", ownerNo);
        form.put("planDraftDate", LocalDate.now().plusDays(7).toString());
        form.put("actualDraftDate", LocalDate.now().toString());
        form.put("enterSelfCheck", "否");
        form.put("version", version);
        return form;
    }

    private long 立项() throws Exception {
        String ownerNo = 造人员("开发页负责人");
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("courseName", "开发页课程" + System.nanoTime());
        form.put("reviewTrack", CourseEnums.TRACK_INTERNAL);
        form.put("domainCode", "零售");
        form.put("ownerNo", ownerNo);
        form.put("initiatedDate", LocalDate.now().toString());
        form.put("expectPublishDate", LocalDate.now().plusDays(30).toString());
        form.put("summary", "开发页保存验证");
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
