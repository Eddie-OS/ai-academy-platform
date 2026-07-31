package com.aiacademy.app.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;

/**
 * 会话绝对有效期 8 小时（需求文档 6.1.6 第 3 条）。
 *
 * <p>无操作 2 小时失效由 Servlet 容器的 session timeout 负责；容器没有「绝对上限」这个概念，
 * 因此这一条只能自己判。共享账号长期不登出是常态，这条限制是 AC4 明示的补偿措施之一。
 */
@Component
public class SessionLifetimeFilter extends OncePerRequestFilter {

    private static final Duration MAX_SESSION_LIFETIME = Duration.ofHours(8);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginAt = session.getAttribute(LoginService.LOGIN_AT);
            if (loginAt instanceof Long millis
                    && Instant.ofEpochMilli(millis).plus(MAX_SESSION_LIFETIME).isBefore(Instant.now())) {
                session.invalidate();
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
