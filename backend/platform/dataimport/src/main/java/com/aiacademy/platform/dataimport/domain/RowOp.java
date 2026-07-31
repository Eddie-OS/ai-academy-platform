package com.aiacademy.platform.dataimport.domain;

/**
 * 行级写入动作。
 *
 * <p>INSERT／UPDATE 两个名字与 {@code import_row_snapshot.op} 的 CHECK 约束一致，撤销时按它分流：
 * INSERT 的行逻辑删除，UPDATE 的行用前值快照还原（规则 RB2）。SKIP 不落快照，因为没写任何东西。
 */
public enum RowOp {
    INSERT,
    UPDATE,
    SKIP
}
