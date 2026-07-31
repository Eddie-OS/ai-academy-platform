package com.aiacademy.common.security;

/**
 * 账号类型。全平台只有两个共享账号（需求文档 6.1、决策 C04）。
 *
 * <p><b>这不是角色，也不是权限。</b>一期没有角色表、权限表、用户表，两个账号的凭据写在配置文件里。
 * 命名遵循《开发实施文档》7.6 对照表：运营账号 = operator，用户账号 = viewer（不用 user）。
 *
 * <p><b>访问约束（AR-7 / PMI-4）：</b>本枚举只允许被权限拦截器与登录相关代码引用。
 * 任何业务代码里出现「比较账号类型」都是违规，ArchUnit 会拦下。
 */
public enum AccountType {

    /** 运营账号：全量写权限，同时是一期的系统管理员（决策 D25）。 */
    OPERATOR("运营账号"),

    /** 用户账号：只读，例外是点赞与评论两个写接口（需求文档 6.2.5）。 */
    VIEWER("用户账号");

    private final String label;

    AccountType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean isOperator() {
        return this == OPERATOR;
    }

    /** Spring Security 权限名。 */
    public String authority() {
        return "ROLE_" + name();
    }
}
