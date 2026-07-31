package com.aiacademy.app.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 取请求的来源 IP，供操作审计日志与登录记录使用（需求 5.12、AC1）。
 *
 * <p>生产部署是 Nginx 反代（开发 4.4），{@code request.getRemoteAddr()} 拿到的是 Nginx 自己的地址，
 * 因此优先取 {@code X-Forwarded-For} 的第一段——那是最初的客户端。
 *
 * <p>这个头可以被伪造。一期接受这个风险：内网 100 人规模，且 IP 只用于审计参考、不参与判权
 * （需求 AC1），为它引入可信代理链校验不成立。
 */
final class ClientIp {

    private ClientIp() {
    }

    static String of(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
