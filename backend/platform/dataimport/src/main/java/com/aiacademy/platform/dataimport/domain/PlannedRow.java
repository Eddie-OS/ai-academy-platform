package com.aiacademy.platform.dataimport.domain;

/**
 * 一行的写入计划。
 *
 * @param targetId UPDATE 时的目标行 ID；INSERT／SKIP 时为 null
 * @param payload Handler 在校验阶段组装好的待写对象。类型由各 Handler 自己知道
 */
public record PlannedRow(ImportRow row, RowOp op, Long targetId, Object payload) {

    /**
     * 取回 Handler 自己放进去的待写对象。
     *
     * <p><b>为什么这里是 Object 而不是泛型：</b>框架要把 6 类导入的计划放在同一个类型里流转
     * （批次表、快照表、错误报告都是通用的），泛型化会让 {@code List<ImportHandler<?>>} 的注入与
     * 通配符捕获渗透到框架的每一处。代价是每个 Handler 的写入方法里有一次强制转换——就一行，
     * 且转换失败是开发期就会炸的编程错误，不是运行期数据问题。
     */
    @SuppressWarnings("unchecked")
    public <T> T payloadAs(Class<T> type) {
        return (T) payload;
    }

    public int rowNo() {
        return row.rowNo();
    }
}
