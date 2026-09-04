package com.aiacademy.app.config;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.junit.jupiter.api.extension.ExtendWith;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 单机模式下的静态资源托管与 SPA 回退（{@link StandaloneWebConfig}）。
 *
 * <p>这四条断言各自对应一个真实踩过的坑，且四个坑的共同点是<b>都不表现为 500</b>——
 * 它们表现为「页面白屏」「接口返回坏 JSON」「JS 报语法错误」，排查方向全被带偏。
 *
 * <p>不用 {@code @SpringBootTest}：这里要验的是 MVC 的路由决策，与数据库无关，
 * 起一次内嵌 PostgreSQL 要二十多秒。用纯 Spring MVC 上下文，毫秒级。
 */
@ExtendWith(SpringExtension.class)
@WebAppConfiguration
@ContextConfiguration(classes = StandaloneWebConfigTest.TestConfig.class)
@ActiveProfiles("standalone")
class StandaloneWebConfigTest {

    /** 静态字段：{@code @DynamicPropertySource} 在上下文创建时就要读到它。 */
    @TempDir
    static Path webRoot;

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;

    @DynamicPropertySource
    static void 指向临时前端目录(DynamicPropertyRegistry registry) {
        registry.add("aiacademy.web-root", webRoot::toString);
    }

    @BeforeAll
    static void 造出一份最小前端产物() throws IOException {
        Files.writeString(webRoot.resolve("index.html"), "<!doctype html><div id=\"root\"></div>");
        Files.createDirectories(webRoot.resolve("assets"));
        Files.writeString(webRoot.resolve("assets/app.js"), "console.log('real asset')");
    }

    @org.junit.jupiter.api.BeforeEach
    void 装配() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    @DisplayName("真实存在的静态文件原样返回，不被回退逻辑截走")
    void 真实文件原样返回() throws Exception {
        mvc.perform(get("/assets/app.js"))
                .andExpect(status().isOk())
                .andExpect(content().string("console.log('real asset')"));
    }

    @Test
    @DisplayName("前端路由路径回退到 index.html——刷新页面与粘贴地址靠的是这条")
    void 前端路由回退到首页() throws Exception {
        // 磁盘上没有 demands/123 这个文件，交给 React Router 解析。
        // 少了这条，运营刷新一下详情页就是 404，而地址栏里的地址明明是刚才点出来的
        mvc.perform(get("/demands/123"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("id=\"root\"")));
    }

    @Test
    @DisplayName("根路径 / 转发到 index.html——它走的是 view controller，不是回退解析器")
    void 根路径转发到首页() throws Exception {
        /*
         * ResourceHttpRequestHandler 在调用解析器之前就用 hasText(path) 把空路径挡掉了，
         * 所以 SPA 回退管不到 /。曾经的表现是：深链正常，而首页 500——
         * 也就是用户打开浏览器碰到的第一个地址是坏的，深链反而是好的。
         */
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }

    @Test
    @DisplayName("拼错的接口路径不回退，让 404 以本来面目出现")
    void 接口路径不回退() throws Exception {
        // 回退了的话前端拿到 200 + <!doctype html> 去 JSON.parse，
        // 报的是「Unexpected token <」，那条报错里没有一处提到 404
        mvc.perform(get("/api/no-such-endpoint"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("缺失的资源文件不回退——否则浏览器把 HTML 当 JS 解析")
    void 缺失的资源文件不回退() throws Exception {
        // 前端换版本漏拷 assets 目录时会撞到。回退会让浏览器报
        // "Unexpected token '<'"，指向 JS 语法，而真正的原因是文件不存在
        mvc.perform(get("/assets/index-deadbeef.js"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/favicon.ico"))
                .andExpect(status().isNotFound());
    }

    @EnableWebMvc
    @Configuration
    @Import(StandaloneWebConfig.class)
    static class TestConfig {
    }
}
