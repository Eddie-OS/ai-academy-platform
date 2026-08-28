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
 * 课程详情「材料与版本」台账：别名、状态、负责人、录屏外链走独立保存，
 * 不改自动版本号、不删快照、不写流转日志。
 */
@AutoConfigureMockMvc
class CourseVersionLedgerIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("保存版本台账再 GET 回填；版本号、主状态与停滞时刻不动")
    void 保存版本台账不改快照() throws Exception {
        String ownerNo = 造人员("版本页负责人");
        long courseId = 立项(ownerNo);
        JsonNode before = 数据(调用("GET", "/api/courses/" + courseId, null));
        long versionId = 数据(调用("POST", "/api/courses/" + courseId + "/material-versions",
                json.writeValueAsString(Map.of("remark", "初稿"))))
                .get("id").asLong();

        调用("PUT", "/api/courses/" + courseId + "/material-versions/" + versionId + "/ledger",
                json.writeValueAsString(台账表单(ownerNo)));

        JsonNode after = 数据(调用("GET", "/api/courses/" + courseId, null));
        JsonNode version = 数据(调用("GET", "/api/courses/" + courseId + "/material-versions", null)).get(0);
        assertThat(version.get("versionNo").asText()).isEqualTo("V1");
        assertThat(version.get("versionLabel").asText()).isEqualTo("V1.0 初稿");
        assertThat(version.get("versionStatus").asText()).isEqualTo("生效版本");
        assertThat(version.get("ownerNo").asText()).isEqualTo(ownerNo);
        assertThat(version.get("updatedDate").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(version.get("coursewareUrl").asText()).isEqualTo("https://files.example.com/ppt.pptx");
        assertThat(version.get("recordingUrl").asText()).isEqualTo("https://files.example.com/trial.mp4");
        assertThat(version.get("remark").asText()).isEqualTo("补齐录屏外链");
        assertThat(after.get("currentMaterialVersion").asText()).isEqualTo("V1");
        assertThat(after.get("mainState").asText()).isEqualTo("立项");
        assertThat(after.get("lastStateChangedAt").asText())
                .isEqualTo(before.get("lastStateChangedAt").asText());
        assertThat(after.get("version").asInt()).isEqualTo(before.get("version").asInt());
    }

    @Test
    @DisplayName("版本状态不在枚举里时 PARAM_INVALID")
    void 非法版本状态被拒() throws Exception {
        long courseId = 立项(造人员("非法状态"));
        long versionId = 数据(调用("POST", "/api/courses/" + courseId + "/material-versions",
                json.writeValueAsString(Map.of()))).get("id").asLong();
        Map<String, Object> form = 台账表单("E0");
        form.put("versionStatus", "当前版");

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/material-versions/" + versionId + "/ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(form))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("PARAM_INVALID");
    }

    @Test
    @DisplayName("录屏必须是外链：不能填本地路径")
    void 非法录屏链接被拒() throws Exception {
        long courseId = 立项(造人员("非法链接"));
        long versionId = 数据(调用("POST", "/api/courses/" + courseId + "/material-versions",
                json.writeValueAsString(Map.of()))).get("id").asLong();
        Map<String, Object> form = 台账表单("E0");
        form.put("recordingUrl", "C:\\video\\trial.mp4");

        JsonNode response = json.readTree(响应体(mvc.perform(as运营(
                        put("/api/courses/" + courseId + "/material-versions/" + versionId + "/ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(form))))
                .andReturn()));
        assertThat(response.get("code").asText()).isEqualTo("PARAM_INVALID");
        assertThat(response.get("message").asText()).contains("http");
    }

    @Test
    @DisplayName("PM1：用户账号读得到版本，写台账被拒")
    void 用户账号只读() throws Exception {
        long courseId = 立项(造人员("只读"));
        long versionId = 数据(调用("POST", "/api/courses/" + courseId + "/material-versions",
                json.writeValueAsString(Map.of()))).get("id").asLong();

        JsonNode read = json.readTree(响应体(mvc.perform(as查看(
                get("/api/courses/" + courseId + "/material-versions"))).andReturn()));
        assertThat(read.get("code").asText()).isEqualTo("OK");
        assertThat(read.get("data").get(0).get("versionNo").asText()).isEqualTo("V1");

        JsonNode write = json.readTree(响应体(mvc.perform(as查看(
                        put("/api/courses/" + courseId + "/material-versions/" + versionId + "/ledger")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(台账表单("E0")))))
                .andReturn()));
        assertThat(write.get("code").asText()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("元数据下发课程版本状态")
    void 枚举下发() throws Exception {
        JsonNode flags = 数据(调用("GET", "/api/meta/field-enums", null));
        JsonNode statuses = flags.get("课程版本状态");
        assertThat(statuses.size()).isEqualTo(3);
        assertThat(statuses.get(0).asText()).isEqualTo("生效版本");
        assertThat(statuses.get(1).asText()).isEqualTo("历史归档");
        assertThat(statuses.get(2).asText()).isEqualTo("废弃版本");
    }

    private Map<String, Object> 台账表单(String ownerNo) {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("versionLabel", "V1.0 初稿");
        form.put("versionStatus", CourseEnums.VERSION_STATUS_CURRENT);
        form.put("ownerNo", ownerNo);
        form.put("updatedDate", LocalDate.now().toString());
        form.put("coursewareUrl", "https://files.example.com/ppt.pptx");
        form.put("recordingUrl", "https://files.example.com/trial.mp4");
        form.put("remark", "补齐录屏外链");
        return form;
    }

    private long 立项(String ownerNo) throws Exception {
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("courseName", "版本页课程" + System.nanoTime());
        form.put("reviewTrack", CourseEnums.TRACK_INTERNAL);
        form.put("domainCode", "零售");
        form.put("ownerNo", ownerNo);
        form.put("initiatedDate", LocalDate.now().toString());
        form.put("expectPublishDate", LocalDate.now().plusDays(30).toString());
        form.put("summary", "版本台账保存验证");
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
