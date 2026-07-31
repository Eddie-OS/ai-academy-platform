package com.aiacademy.platform.dataimport.service;

import com.aiacademy.platform.dataimport.ImportRowWriter;
import com.aiacademy.platform.dataimport.repository.RowSnapshotRepository;

import java.util.function.LongSupplier;

/**
 * {@link ImportRowWriter} 的唯一实现：每次写入前后各记一笔行快照。
 *
 * <p>一次导入一个实例（持有批次号），因此不是 Spring Bean。
 */
final class SnapshotRowWriter implements ImportRowWriter {

    private final RowSnapshotRepository snapshots;
    private final String batchNo;
    private final String operator;

    SnapshotRowWriter(RowSnapshotRepository snapshots, String batchNo, String operator) {
        this.snapshots = snapshots;
        this.batchNo = batchNo;
        this.operator = operator;
    }

    @Override
    public String batchNo() {
        return batchNo;
    }

    @Override
    public String operator() {
        return operator;
    }

    @Override
    public long insert(int rowNo, String table, LongSupplier insert) {
        long id = insert.getAsLong();
        snapshots.recordInsert(batchNo, rowNo, table, id, operator);
        return id;
    }

    @Override
    public void update(int rowNo, String table, long targetId, Runnable update) {
        // 顺序是本类存在的全部理由：先取前值，再更新
        snapshots.recordUpdateBefore(batchNo, rowNo, table, targetId, operator);
        update.run();
    }
}
