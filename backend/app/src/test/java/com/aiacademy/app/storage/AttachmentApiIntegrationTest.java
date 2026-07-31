package com.aiacademy.app.storage;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.security.AccountType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

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
 * 附件接口的 HTTP 层（TD-7）。规则 F1～F3、P5 的业务判定已在
 * {@link AttachmentIntegrationTest} 用服务层验过，这里只测走 HTTP 才暴露的部分。
 */
@AutoConfigureMockMvc
class AttachmentApiIntegrationTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            'a', 'i', '-', 'a', 'c', 'a', 'd', 'e', 'm', 'y'};

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Test
    @DisplayName("三段式接口走通：申请 → PUT 分片 → 合并 → 下载，下载响应头带原始中文文件名")
    void 上传下载走通() throws Exception {
        String uploadId = json.readTree(mvc.perform(as运营(post("/api/attachments/uploads"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fileName":"案例封面.png","fileSize":%d,
                                 "scene":"GENERAL","ownerType":"CASE"}
                                """.formatted(PNG.length)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.chunkSize").value(5 * 1024 * 1024))
                        .andExpect(jsonPath("$.data.totalChunks").value(1))
                        .andReturn().getResponse().getContentAsString())
                .path("data").path("uploadId").asText();

        mvc.perform(as运营(multipart("/api/attachments/uploads/{id}/chunks/{index}", uploadId, 0)
                        .file(new MockMultipartFile("file", "chunk0", null, PNG))
                        .with(request -> {
                            // multipart() 默认发 POST，分片接口是 PUT（同序号重传必须是覆盖语义）
                            request.setMethod("PUT");
                            return request;
                        })))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(PNG.length));

        long id = json.readTree(mvc.perform(as运营(
                        post("/api/attachments/uploads/{id}/completion", uploadId)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.fileName").value("案例封面.png"))
                        .andExpect(jsonPath("$.data.sha256").isNotEmpty())
                        .andReturn().getResponse().getContentAsString())
                .path("data").path("id").asLong();

        byte[] downloaded = mvc.perform(as运营(get("/api/attachments/{id}/download", id)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, PNG.length))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.containsString("filename*=UTF-8''")))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(downloaded).isEqualTo(PNG);
    }

    @Test
    @DisplayName("F3：未登录不得下载附件，一期唯一的访问控制点")
    void 未登录不得下载() throws Exception {
        mvc.perform(get("/api/attachments/{id}/download", 1))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    @DisplayName("查看账号可以下载但不能上传——它是只读账号（需求 6.2）")
    void 查看账号只读() throws Exception {
        mvc.perform(post("/api/attachments/uploads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fileName":"x.png","fileSize":10,"scene":"GENERAL","ownerType":"CASE"}
                                """)
                        .with(csrf())
                        .with(user("viewer").authorities(
                                new SimpleGrantedAuthority(AccountType.VIEWER.authority()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("F1／F2：场景上限与格式白名单在申请阶段就返回 400，前端不必先传完 200MB")
    void 申请阶段拦截() throws Exception {
        mvc.perform(as运营(post("/api/attachments/uploads"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fileName":"演示.mp4","fileSize":1024,
                                 "scene":"COURSEWARE","ownerType":"COURSE"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("不支持的文件格式")));

        mvc.perform(as运营(post("/api/attachments/uploads"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fileName":"大附件.pdf","fileSize":22020096,
                                 "scene":"GENERAL","ownerType":"DEMAND"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("20MB")));
    }

    // -------------------------------------------------------------------------

    private MockHttpServletRequestBuilder as运营(MockHttpServletRequestBuilder builder) {
        return builder.with(csrf()).with(user("operator")
                .authorities(new SimpleGrantedAuthority(AccountType.OPERATOR.authority())));
    }
}
