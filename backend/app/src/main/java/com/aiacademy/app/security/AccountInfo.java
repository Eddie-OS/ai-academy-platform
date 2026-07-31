package com.aiacademy.app.security;

/**
 * 登录态信息，下发给前端用于决定「写操作入口是否整体渲染」（规则 PMI-5）。
 *
 * <p>前端只依据 {@code operator} 这一个布尔值决定入口渲染，
 * <b>不得依赖接口返回的其他字段是否为空来推断权限</b>。
 *
 * @param username    登录名
 * @param displayName 展示名
 * @param accountType 账号类型代码：OPERATOR / VIEWER
 * @param typeLabel   账号类型中文名
 * @param operator    是否运营账号（唯一的前端判断依据）
 */
public record AccountInfo(String username,
                          String displayName,
                          String accountType,
                          String typeLabel,
                          boolean operator) {
}
