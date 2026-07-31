package com.aiacademy.platform.audit.domain;

/**
 * 操作类型（需求 5.12）。取值与表 {@code audit_op_log} 的 CHECK 约束逐字一致。
 *
 * <p>枚举落库写中文而不是数字码或英文名，遵循开发 6.1.3：一期全部枚举列存中文字符串，
 * 让人能直接看懂 SQL 查询结果，代价是改名要写迁移脚本——而这些名字来自需求正文，不会改。
 */
public enum OpType {

    CREATE("新增"),
    UPDATE("修改"),
    DELETE("删除"),
    IMPORT("导入"),
    EXPORT("导出"),
    URGE("发送催办"),
    REVOKE_IMPORT("撤销导入");

    private final String dbValue;

    OpType(String dbValue) {
        this.dbValue = dbValue;
    }

    public String dbValue() {
        return dbValue;
    }

    /** 需求 5.12：字段名与变更前后值「修改类操作必填」，其余操作留空。 */
    public boolean requiresFieldDiff() {
        return this == UPDATE;
    }
}
