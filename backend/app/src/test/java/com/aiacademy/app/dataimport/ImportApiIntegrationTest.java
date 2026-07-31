package com.aiacademy.app.dataimport;

import com.aiacademy.common.security.AccountType;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 导入中心的 HTTP 接口（需求 13.8.2／13.8.3／13.8.4／13.8.5）。
 *
 * <p>业务规则已经在 {@link ImportFrameworkIntegrationTest} 等三个类里用服务层验过，这里只测
 * <b>只有走 HTTP 才会暴露的东西</b>：multipart 解析、上传与确认拆成两次请求后批次号能不能接上、
 * 下载响应头、以及规则 I7 的写接口账号限制。
 */
@AutoConfigureMockMvc
class ImportApiIntegrationTest extends ImportTestBase {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Test
    @DisplayName("13.8.2：模板下载给的是真的 xlsx，文件名按需求命名且中文不乱码")
    void 下载模板() throws Exception {
        MvcResult result = mvc.perform(as运营(get("/api/imports/templates/attendance")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.containsString("filename*=UTF-8''")))
                .andReturn();

        byte[] body = result.getResponse().getContentAsByteArray();
        assertThat(new String(body, 0, 2, StandardCharsets.ISO_8859_1))
                .describedAs("xlsx 是 zip 容器，前两个字节必须是 PK。返回 HTML 错误页时这里会立刻红")
                .isEqualTo("PK");
        assertThat(result.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION))
                .contains(java.net.URLEncoder.encode(
                        ImportType.ATTENDANCE.templateFileName(), StandardCharsets.UTF_8)
                        .replace("+", "%20"));
    }

    @Test
    @DisplayName("API-1：六类模板的 URL 都用小写连字符，带下划线的枚举名不能泄进路径")
    void 六类模板的URL都能取到() throws Exception {
        for (String urlName : List.of("people", "attendance", "lecturer", "attendee",
                "training-feedback", "trial-feedback")) {
            mvc.perform(as运营(get("/api/imports/templates/{type}", urlName)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("13.8.3：上传 → 确认 → 撤销三次请求接得上，批次号是它们之间唯一的凭据")
    void 三步向导走通() throws Exception {
        String employeeNo = "E" + System.nanoTime();
        byte[] file = ImportFile.of(模板(ImportType.PEOPLE), List.of(
                List.of(employeeNo, "张三", "客服中心", "工程师", "z@example.com", "两者", "在职")));

        String batchNo = json.readTree(mvc.perform(as运营(
                        multipart("/api/imports/people/uploads")
                                .file(new MockMultipartFile("file", "人员.xlsx",
                                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                        file))))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.code").value("OK"))
                        .andExpect(jsonPath("$.data.canConfirm").value(true))
                        .andExpect(jsonPath("$.data.insertRows").value(1))
                        .andReturn().getResponse().getContentAsString())
                .path("data").path("batchNo").asText();
        assertThat(batchNo).startsWith("RY");
        assertThat(计数("SELECT COUNT(*) FROM org_employee WHERE employee_no = ?", employeeNo))
                .describedAs("规则 I3：上传阶段一行都不许写")
                .isZero();

        mvc.perform(as运营(post("/api/imports/{batchNo}/confirmation", batchNo)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.importResult").value("成功"));
        assertThat(计数("SELECT COUNT(*) FROM org_employee WHERE employee_no = ?", employeeNo)).isEqualTo(1);

        mvc.perform(as运营(post("/api/imports/{batchNo}/revocation", batchNo)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revokedRows").value(1))
                .andExpect(jsonPath("$.data.skippedRows").value(0));
        assertThat(计数("SELECT COUNT(*) FROM org_employee WHERE employee_no = ? AND deleted = TRUE",
                employeeNo)).isEqualTo(1);
    }

    @Test
    @DisplayName("I8：重复确认返回 DUPLICATE_SUBMIT 与 409，而不是 500")
    void 重复确认的响应码() throws Exception {
        String batchNo = 导入(ImportType.PEOPLE, List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在职")));

        mvc.perform(as运营(post("/api/imports/{batchNo}/confirmation", batchNo)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_SUBMIT"))
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("已写入")));
    }

    @Test
    @DisplayName("13.8.4：批次列表按类型筛选，返回统一分页结构")
    void 批次列表() throws Exception {
        导入(ImportType.PEOPLE, List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在职")));

        mvc.perform(as运营(get("/api/imports").param("type", "people").param("pageSize", "5")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.data.records[0].importType").value("人员"));

        // URL 参数拼错该是 400 而不是 500
        mvc.perform(as运营(get("/api/imports").param("type", "不存在的类型")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAM_INVALID"));
    }

    @Test
    @DisplayName("I4：错误报告与原文件都能下载，且带 Content-Length 让进度条显示总量")
    void 下载原文件与错误报告() throws Exception {
        byte[] file = ImportFile.of(模板(ImportType.PEOPLE), List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在岗")));
        String batchNo = json.readTree(mvc.perform(as运营(
                        multipart("/api/imports/people/uploads")
                                .file(new MockMultipartFile("file", "有错的人员.xlsx", null, file))))
                        .andExpect(jsonPath("$.data.canConfirm").value(false))
                        .andReturn().getResponse().getContentAsString())
                .path("data").path("batchNo").asText();

        mvc.perform(as运营(get("/api/imports/{batchNo}/error-report", batchNo)))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.CONTENT_LENGTH));
        mvc.perform(as运营(get("/api/imports/{batchNo}/source-file", batchNo)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.containsString("attachment")));
    }

    @Test
    @DisplayName("I7：查看账号不能导入。判定在 PermissionInterceptor 一处完成，Controller 里没有账号判断")
    void 查看账号不能导入() throws Exception {
        byte[] file = ImportFile.of(模板(ImportType.PEOPLE), List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在职")));

        mvc.perform(multipart("/api/imports/people/uploads")
                        .file(new MockMultipartFile("file", "人员.xlsx", null, file))
                        .with(csrf())
                        .with(user("viewer").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                        AccountType.VIEWER.authority()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("未登录连模板都拿不到——一期的访问控制点只有登录态，但它绝不能省")
    void 未登录被拒() throws Exception {
        mvc.perform(get("/api/imports/templates/people"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // -------------------------------------------------------------------------

    private MockHttpServletRequestBuilder as运营(MockHttpServletRequestBuilder builder) {
        return builder.with(csrf()).with(user("operator").authorities(
                new org.springframework.security.core.authority.SimpleGrantedAuthority(
                        AccountType.OPERATOR.authority())));
    }
}
