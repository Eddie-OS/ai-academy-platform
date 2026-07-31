package com.aiacademy.app.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 两个共享账号的凭据来源，对应需求文档 6.1 与《开发实施文档》1.2 事实 6：
 * 不建用户表、不建角色表，凭据写在配置里。
 *
 * <p><b>口令必须是 BCrypt 哈希，不得明文</b>（规则 SEC5：加盐哈希存储；SEC4：凭据不得记入日志）。
 * 生产环境的哈希值通过环境变量注入，见 application-prod.yml 与 README「配置与敏感信息」一节。
 *
 * <p>生成哈希的方式见 README；一期不做改密页面之外的任何账号管理功能（不做项第 11 条）。
 */
@ConfigurationProperties(prefix = "aiacademy.accounts")
public record SharedAccountProperties(Account operator, Account viewer) {

    /**
     * @param username     登录名
     * @param passwordHash BCrypt 哈希，形如 {@code $2a$10$...}
     * @param displayName  界面上展示的账号名
     */
    public record Account(String username, String passwordHash, String displayName) {
    }
}
