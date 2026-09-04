package com.aiacademy.app.security;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 登录记录（开发 6.2.1）。<b>成功与失败都要留痕</b>，失败记录是共享账号下发现「有人在猜口令」的
 * 唯一线索。
 *
 * <p>直接调 {@link LoginService} 而不走 MockMvc：要验的是「记了什么」，而登录接口那一层
 * （CSRF、会话固定）在 E0 冒烟测试里已经用真实 HTTP 走过了。
 */
class LoginLogIntegrationTest extends IntegrationTest {

    // 口令用继承来的 IntegrationTest.OPERATOR_PASSWORD：它与 @DynamicPropertySource
    // 注入给应用的是同一个值，不会出现「配置改了、测试里的字面量没改」这种只报「登录失败」的漂移。

    @Autowired
    private LoginService loginService;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("登录成功记一行：账号类型、来源 IP、User-Agent 都在")
    void 成功登录留痕() {
        MockHttpServletRequest request = 请求("172.16.0.9", "Mozilla/5.0 冒烟");
        loginService.login("operator", OPERATOR_PASSWORD, request, new MockHttpServletResponse());

        Map<String, Object> row = 最新一行();
        assertThat(row.get("success")).isEqualTo(true);
        assertThat(row.get("account_type")).isEqualTo("OPS");
        assertThat(row.get("login_ip"))
                .describedAs("生产走 Nginx 反代，remoteAddr 是 Nginx 自己，必须取 X-Forwarded-For 的第一段")
                .isEqualTo("172.16.0.9");
        assertThat(row.get("user_agent")).isEqualTo("Mozilla/5.0 冒烟");
        assertThat(row.get("fail_reason")).isNull();
        assertThat(row.get("logged_at")).isNotNull();
    }

    @Test
    @DisplayName("SEC4：口令错误记一行失败，且失败原因里没有口令")
    void 口令错误留痕且不泄露口令() {
        String 口令 = "wrong-password-秘密";
        assertThatThrownBy(() -> loginService.login(
                "operator", 口令, 请求("172.16.0.10", "curl"), new MockHttpServletResponse()))
                .isInstanceOf(BizException.class);

        Map<String, Object> row = 最新一行();
        assertThat(row.get("success")).isEqualTo(false);
        assertThat(row.get("account_type")).isEqualTo("OPS");
        assertThat(row.get("fail_reason"))
                .describedAs("规则 SEC4：日志里不得出现任何口令内容")
                .isEqualTo("账号或密码错误")
                .asString().doesNotContain(口令);
    }

    @Test
    @DisplayName("用户名不匹配任一共享账号时账号类型留空——这类记录最该留，说明有人在猜用户名")
    void 未知用户名也留痕() {
        assertThatThrownBy(() -> loginService.login(
                "admin", "试试看", 请求("172.16.0.11", "curl"), new MockHttpServletResponse()))
                .isInstanceOf(BizException.class);

        Map<String, Object> row = 最新一行();
        assertThat(row.get("success")).isEqualTo(false);
        assertThat(row.get("account_type")).isNull();
        assertThat(row.get("login_ip")).isEqualTo("172.16.0.11");
    }

    private MockHttpServletRequest 请求(String ip, String userAgent) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.addHeader("X-Forwarded-For", ip + ", 10.0.0.1");
        request.addHeader("User-Agent", userAgent);
        return request;
    }

    private Map<String, Object> 最新一行() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM sys_login_log ORDER BY id DESC LIMIT 1");
        assertThat(rows).describedAs("登录记录一行都没写").hasSize(1);
        return rows.get(0);
    }
}
