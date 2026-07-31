package com.aiacademy.platform.dataimport;

import java.util.function.LongSupplier;

/**
 * Handler 写数据的唯一出口。每一次写都顺带记一条行快照（{@code import_row_snapshot}）。
 *
 * <p><b>为什么快照不交给各 Handler 自己记：</b>撤销（规则 RB2）能不能还原全部数据，取决于导入时
 * 有没有把<b>每一行</b>的前值留下来。这件事一旦分散到 6 个 Handler 里，就是 6 次「记得写」的纪律
 * 要求，而漏写的后果在导入时完全看不出来——只有半年后运营撤销某个批次、发现数据没回全时才暴露。
 * 把它绑在写操作上之后，「写了但没快照」在结构上不可能发生。
 *
 * <p>同一行可以写多张表：签到导入的一行既写 {@code dtl_attendance}，又可能自动补一条
 * {@code dtl_session_attendee}（需求 14.4）。两次调用记两条快照，撤销时两张表都能回滚
 * （验收 A8-7 要求撤销签到批次时一并回滚自动补入的名单）。
 */
public interface ImportRowWriter {

    /** 本次导入的批次号。写入行的 {@code import_batch_no} 列要落它（规则 I5）。 */
    String batchNo();

    /** 当前账号，落 {@code created_by / updated_by}。共享账号下就是「运营」（C04）。 */
    String operator();

    /**
     * 插入一行并记 INSERT 快照。
     *
     * @param insert 实际执行插入并返回新行 ID。返回 ID 是必需的：撤销时要按 ID 逻辑删除这一行
     */
    long insert(int rowNo, String table, LongSupplier insert);

    /**
     * 更新一行：先取前值快照，再执行更新。
     *
     * <p>顺序不能颠倒——更新之后再取快照，取到的就是新值，撤销会把新值再写回去一遍，
     * 看起来「还原成功」，实际上什么都没回滚。
     */
    void update(int rowNo, String table, long targetId, Runnable update);
}
