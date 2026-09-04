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
 * 课程详情「立项」页：规格 13 项走独立保存接口，不改课程主状态、不写流转日志。
 */
@AutoConfigureMockMvc
class CourseInitiationIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("新建课后有立项单号；保存再 GET 回填；主状态与停滞时刻不动")
    void 保存立项信息不改主状态() throws Exception {
        long courseId = 立项();
        JsonNode before = 数据(调用("GET", "/api/courses/" + courseId, null));
        String yearMonth = LocalDate.now().toString().substring(0, 7).replace("-", "");
        assertThat(before.get("initiationNo").asText()).matches("LI" + yearMonth + "\\d{4}");
        assertThat(before.get("mainState").asText()).isEqualTo("立项");

        Map<String, Object> form = 立项表单(before.get("version").asInt());
        调用("PUT", "/api/courses/" + courseId + "/initiation", json.writeValueAsString(form));

        JsonNode after = 数据(调用("GET", "/api/courses/" + courseId, null));
        assertThat(after.get("businessPain").asText()).isEqualTo("一线不会写提示词");
        assertThat(after.get("courseGoal").asText()).isEqualTo("能独立完成一次提示词迭代");
        assertThat(after.get("courseValue").asText()).isEqualTo("缩短一线上手周期");
        assertThat(after.get("targetAudience").asText()).isEqualTo("一线客服");
        assertThat(after.get("outlineSummary").asText()).isEqualTo("痛点 / 写法 / 练习");
        assertThat(after.get("estimateDevDays").decimalValue()).isEqualByComparingTo("5.5");
        assertThat(after.get("reviewJudges").asText()).isEqualTo("张三、李四");
        assertThat(after.get("initiationReviewDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(after.get("initiationReviewConclusion").asText()).isEqualTo("PASS");
        assertThat(after.get("initiationReviewOpinion").asText()).isEqualTo("目标清晰，可以启动开发");
        assertThat(after.get("initiationStatus").asText()).isEqualTo("DONE");
        assertThat(after.get("mainState").asText())
                .describedAs("立项状态是字典手选，不能把课程主状态推走")
                .isEqualTo("立项");
        assertThat(after.get("lastStateChangedAt").asText())
                .isEqualTo(before.get("lastStateChangedAt").asText());
        assertThat(after.get("version").asInt()).isEqualTo(before.get("version").asInt() + 1);
    }

    @Test
    @DisplayName("立项评审结论不在字典里时 PARAM_INVALID")
    void 非法结论码被拒() throws Exception {
        long courseId = 立项();
        int version = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        Map<String, Object> form = 立项表单(version);
        form.put("initiationReviewConclusion", "NOT_A_CODE");

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/initiation")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(form))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("PARAM_INVALID");
        assertThat(数据(调用("GET", "/api/courses/" + courseId, null)).get("initiationReviewConclusion").isNull())
                .isTrue();
    }

    @Test
    @DisplayName("K1：立项页保存也走乐观锁")
    void 版本过期冲突() throws Exception {
        long courseId = 立项();
        int stale = 数据(调用("GET", "/api/courses/" + courseId, null)).get("version").asInt();
        调用("PUT", "/api/courses/" + courseId + "/initiation", json.writeValueAsString(立项表单(stale)));

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/initiation")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(立项表单(stale)))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("CONCURRENT_MODIFIED");
        assertThat(response.get("message").asText()).contains("已被他人修改");
    }

    @Test
    @DisplayName("PM1：用户账号读得到立项字段，写被拒")
    void 用户账号只读() throws Exception {
        long courseId = 立项();
        JsonNode read = json.readTree(响应体(mvc.perform(as查看(get("/api/courses/" + courseId))).andReturn()));
        assertThat(read.get("code").asText()).isEqualTo("OK");
        assertThat(read.get("data").get("initiationNo").asText()).startsWith("LI");

        JsonNode write = json.readTree(响应体(mvc.perform(as查看(
                        put("/api/courses/" + courseId + "/initiation")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(立项表单(0)))))
                .andReturn()));
        assertThat(write.get("code").asText()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("元数据下发立项状态与立项评审结论，前端不手写选项")
    void 字典下发() throws Exception {
        JsonNode dicts = 数据(调用("GET", "/api/meta/dicts", null));
        assertThat(dicts.get("课程立项状态").findValuesAsText("code"))
                .containsExactly("PENDING", "IN_PROGRESS", "DONE");
        assertThat(dicts.get("课程立项评审结论").findValuesAsText("code"))
                .containsExactly("PASS", "FAIL");
    }

    private Map<String, Object> 立项表单(int version) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("businessPain", "一线不会写提示词");
        form.put("courseGoal", "能独立完成一次提示词迭代");
        form.put("courseValue", "缩短一线上手周期");
        form.put("targetAudience", "一线客服");
        form.put("outlineSummary", "痛点 / 写法 / 练习");
        form.put("estimateDevDays", "5.5");
        form.put("reviewJudges", "张三、李四");
        form.put("initiationReviewDate", LocalDate.now().toString());
        form.put("initiationReviewConclusion", "PASS");
        form.put("initiationReviewOpinion", "目标清晰，可以启动开发");
        form.put("initiationStatus", "DONE");
        form.put("version", version);
        return form;
    }

    private long 立项() throws Exception {
        String ownerNo = 造人员("立项页负责人");
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("courseName", "立项页课程" + System.nanoTime());
        form.put("reviewTrack", CourseEnums.TRACK_INTERNAL);
        form.put("domainCode", "COURSE");
        form.put("ownerNo", ownerNo);
        form.put("initiatedDate", LocalDate.now().toString());
        form.put("expectPublishDate", LocalDate.now().plusDays(30).toString());
        form.put("summary", "立项页保存验证");
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
