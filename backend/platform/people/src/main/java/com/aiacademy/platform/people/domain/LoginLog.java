package com.aiacademy.platform.people.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.OffsetDateTime;

/**
 * 登录记录，对应表 {@code sys_login_log}（开发 6.2.1）。
 *
 * <p>共享账号下这张表的价值有限但不为零：它是「有多少台机器在用运营账号」的唯一线索，
 * 与 {@code audit_op_log.operator_ip} 一起构成共享账号下的粗粒度追溯能力（需求 AC1）。
 *
 * <p>追加写、不删除，因此不套公共字段模板。
 */
@TableName("sys_login_log")
public class LoginLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** OPS / USER。登录失败且用户名不匹配任一共享账号时为 null。 */
    private String accountType;

    private String loginIp;

    private String userAgent;

    private Boolean success;

    /** 失败原因。<b>不得写入任何口令内容</b>（规则 SEC4）。 */
    private String failReason;

    private OffsetDateTime loggedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAccountType() {
        return accountType;
    }

    public void setAccountType(String accountType) {
        this.accountType = accountType;
    }

    public String getLoginIp() {
        return loginIp;
    }

    public void setLoginIp(String loginIp) {
        this.loginIp = loginIp;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public Boolean getSuccess() {
        return success;
    }

    public void setSuccess(Boolean success) {
        this.success = success;
    }

    public String getFailReason() {
        return failReason;
    }

    public void setFailReason(String failReason) {
        this.failReason = failReason;
    }

    public OffsetDateTime getLoggedAt() {
        return loggedAt;
    }

    public void setLoggedAt(OffsetDateTime loggedAt) {
        this.loggedAt = loggedAt;
    }
}
