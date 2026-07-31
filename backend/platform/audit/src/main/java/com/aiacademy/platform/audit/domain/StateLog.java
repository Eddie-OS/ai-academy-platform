package com.aiacademy.platform.audit.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.OffsetDateTime;

/**
 * 状态流转日志，对应表 {@code audit_state_log}（需求 5.11）。
 *
 * <p><b>追加写，永不更新、永不删除</b>，所以没有 {@code updated_at / updated_by / deleted}
 * 三个公共字段，也没有 {@code @TableLogic}。这不是漏写：给审计日志加 deleted 列等于给
 * 「删审计记录」提供入口（V1_001 的表头注释、开发 5.2.1）。
 *
 * <p>它是效率类 9 个指标与红灯停滞预警的<b>唯一</b>数据源，与 {@link OpLog} 严格分开。
 */
@TableName("audit_state_log")
public class StateLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String objectType;

    private Long objectId;

    /** 状态字段中文名，如「需求评审状态」。一个对象有多个状态字段，靠这一列区分。 */
    private String stateField;

    /** 变更前状态。对象新建时为 null。 */
    private String fromState;

    private String toState;

    private String actionCode;

    /** OPS 或 SYSTEM。用户账号不能改状态，故本列不会出现 USER。 */
    private String accountType;

    /** 二期一人一账号的预留列，本期恒为 null（开发 5.2.4）。 */
    private String operatorNo;

    /** 二期一人一账号的预留列，本期恒为 null（开发 5.2.4）。 */
    private String operatorName;

    private OffsetDateTime changedAt;

    private String remark;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getObjectType() {
        return objectType;
    }

    public void setObjectType(String objectType) {
        this.objectType = objectType;
    }

    public Long getObjectId() {
        return objectId;
    }

    public void setObjectId(Long objectId) {
        this.objectId = objectId;
    }

    public String getStateField() {
        return stateField;
    }

    public void setStateField(String stateField) {
        this.stateField = stateField;
    }

    public String getFromState() {
        return fromState;
    }

    public void setFromState(String fromState) {
        this.fromState = fromState;
    }

    public String getToState() {
        return toState;
    }

    public void setToState(String toState) {
        this.toState = toState;
    }

    public String getActionCode() {
        return actionCode;
    }

    public void setActionCode(String actionCode) {
        this.actionCode = actionCode;
    }

    public String getAccountType() {
        return accountType;
    }

    public void setAccountType(String accountType) {
        this.accountType = accountType;
    }

    public String getOperatorNo() {
        return operatorNo;
    }

    public void setOperatorNo(String operatorNo) {
        this.operatorNo = operatorNo;
    }

    public String getOperatorName() {
        return operatorName;
    }

    public void setOperatorName(String operatorName) {
        this.operatorName = operatorName;
    }

    public OffsetDateTime getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(OffsetDateTime changedAt) {
        this.changedAt = changedAt;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
