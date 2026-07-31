package com.aiacademy.platform.audit.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.OffsetDateTime;

/**
 * 操作审计日志，对应表 {@code audit_op_log}（需求 5.12）。
 *
 * <p>与 {@link StateLog} 同样是追加写、无公共字段模板。<b>它不参与任何预警判定</b>，
 * 只用于追溯与责任界定；反过来说效率指标也绝不能从这张表取数（开发 5.2.1）。
 *
 * <p>一次「修改」操作会写<b>多行</b>——每个实际变化的字段一行。整体序列化 DTO 写一行的做法
 * 会把附件内容、长文本与凭据一起写进日志（开发 5.2.3 坑一）。
 */
@TableName("audit_op_log")
public class OpLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String objectType;

    /** 导入、导出这类不针对单个对象的操作为 null。 */
    private Long objectId;

    /** 中文枚举，见 {@link OpType#dbValue()}。 */
    private String opType;

    /** 被改字段名。修改类操作必填，其余为 null。 */
    private String fieldName;

    private String oldValue;

    private String newValue;

    private String accountType;

    private String operatorNo;

    private String operatorName;

    /** 需求 5.12 必填。共享账号下这是唯一能区分「从哪台机器操作」的线索。 */
    private String operatorIp;

    private OffsetDateTime operatedAt;

    /** 破坏性操作二次确认弹窗中选填的操作人（开发 5.2.4）。 */
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

    public String getOpType() {
        return opType;
    }

    public void setOpType(String opType) {
        this.opType = opType;
    }

    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public String getOldValue() {
        return oldValue;
    }

    public void setOldValue(String oldValue) {
        this.oldValue = oldValue;
    }

    public String getNewValue() {
        return newValue;
    }

    public void setNewValue(String newValue) {
        this.newValue = newValue;
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

    public String getOperatorIp() {
        return operatorIp;
    }

    public void setOperatorIp(String operatorIp) {
        this.operatorIp = operatorIp;
    }

    public OffsetDateTime getOperatedAt() {
        return operatedAt;
    }

    public void setOperatedAt(OffsetDateTime operatedAt) {
        this.operatedAt = operatedAt;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
