package com.aiacademy.platform.dataimport.domain;

/**
 * 一条行快照（{@code import_row_snapshot}）。
 *
 * @param beforeJson UPDATE 时的变更前完整行（{@code to_jsonb(t)} 的结果）；INSERT 时为 null
 */
public record SnapshotRow(long id, String batchNo, int rowNo, String targetTable,
                          Long targetId, String op, String beforeJson) {

    public boolean isInsert() {
        return RowOp.INSERT.name().equals(op);
    }
}
