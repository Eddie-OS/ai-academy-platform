package com.aiacademy.platform.dataimport.repository;

import com.aiacademy.platform.dataimport.domain.RowOp;
import com.aiacademy.platform.dataimport.domain.SnapshotRow;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * 行快照的写入与回放（开发 5.6.3 细节四，规则 RB2）。
 *
 * <p><b>为什么这一处用 JdbcTemplate 而不是 MyBatis：</b>快照与还原是<b>按表名动态</b>的——
 * 6 类导入写 7 张业务表，将来还会增加。用 {@code to_jsonb(t)} 取整行、用
 * {@code jsonb_populate_record} 把整行写回去，一套 SQL 覆盖所有表；改成 MyBatis 就得为每张目标表
 * 写一对「取快照 / 还原」的语句，而漏写一张表的后果是那张表的撤销静默不生效。
 * 这也是选 PostgreSQL 的直接收益之一（开发 3.3）。
 *
 * <p>表名与列名来自本类自己产生的快照（{@code to_jsonb} 的键就是库里的列名），不是外部输入；
 * 即便如此仍做两道校验：标识符正则 + 与 {@code information_schema} 对账。拼字符串进 SQL 的地方
 * 一律要能说清「为什么这里不可能被注入」。
 */
@Repository
public class RowSnapshotRepository {

    private static final Pattern IDENTIFIER = Pattern.compile("[a-z_][a-z0-9_]*");

    private final JdbcTemplate jdbc;

    /** 表名 → 可赋值列（排除生成列与主键）。库结构在运行期不变，进程内缓存一次即可。 */
    private final Map<String, List<String>> updatableColumns = new ConcurrentHashMap<>();

    public RowSnapshotRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 记 INSERT 快照。撤销时按 {@code target_id} 逻辑删除这一行。 */
    public void recordInsert(String batchNo, int rowNo, String table, long targetId, String operator) {
        checkIdentifier(table);
        jdbc.update("""
                INSERT INTO import_row_snapshot (batch_no, row_no, target_table, target_id, op, created_by)
                VALUES (?, ?, ?, ?, 'INSERT', ?)
                """, batchNo, rowNo, table, targetId, operator);
    }

    /**
     * 记 UPDATE 快照：把目标行<b>当前</b>的完整内容存成 JSONB。
     *
     * <p>必须在执行更新之前调用。{@code to_jsonb(t)} 取的是「现在」的行，更新之后再取就是新值，
     * 撤销时会把新值又写回去一遍——看起来还原成功，实际什么都没回滚。
     */
    public void recordUpdateBefore(String batchNo, int rowNo, String table, long targetId, String operator) {
        checkIdentifier(table);
        int inserted = jdbc.update("""
                INSERT INTO import_row_snapshot (batch_no, row_no, target_table, target_id, op, before_json, created_by)
                SELECT ?, ?, ?, ?, 'UPDATE', to_jsonb(t), ?
                  FROM %s t
                 WHERE t.id = ?
                """.formatted(table), batchNo, rowNo, table, targetId, operator, targetId);
        if (inserted == 0) {
            // 目标行不存在却计划更新它，说明校验阶段与写入阶段的结论不一致。宁可炸掉整批（事务回滚），
            // 也不能写下一条没有前值的 UPDATE 快照——那条快照会让撤销以为「无需还原」。
            throw new IllegalStateException("取前值快照失败，目标行不存在：" + table + "#" + targetId);
        }
    }

    /**
     * 按批次取全部快照，<b>倒序</b>。
     *
     * <p>倒序回放是撤销的通用要求：同一批次里可能先插父行再插子行（签到导入先补名单再写签到），
     * 逆序删除才不会撞外键。
     */
    public List<SnapshotRow> findByBatchDesc(String batchNo) {
        return jdbc.query("""
                SELECT id, batch_no, row_no, target_table, target_id, op, before_json::text AS before_json
                  FROM import_row_snapshot
                 WHERE batch_no = ?
                 ORDER BY id DESC
                """, (rs, n) -> new SnapshotRow(
                        rs.getLong("id"),
                        rs.getString("batch_no"),
                        rs.getInt("row_no"),
                        rs.getString("target_table"),
                        rs.getObject("target_id", Long.class),
                        rs.getString("op"),
                        rs.getString("before_json")),
                batchNo);
    }

    /**
     * 用前值快照还原一行（规则 RB2 的「更新的还原为导入前的值」）。
     *
     * <p>{@code updated_at <= importedAt} 是规则 RB3：这一行在本批次导入之后又被改过的，不还原，
     * 由调用方列进「已跳过」清单。否则撤销一个上周的批次会把这周的修改覆盖掉——那比不撤销更糟。
     *
     * <p><b>整行还原，包含 {@code updated_at / updated_by}</b>：出口准则 E1-6 的说法是「数据完整
     * 还原到导入前状态」，逐字做到才能用「整行相等」来验证。撤销这件事本身留痕在
     * {@code audit_op_log}（规则 RB5）与批次的「已撤销」状态上，不需要靠业务行的时间戳来体现。
     *
     * @return true 已还原；false 已被后续修改，跳过
     */
    public boolean restore(String table, long targetId, String beforeJson, OffsetDateTime importedAt) {
        checkIdentifier(table);
        String setClause = String.join(", ", updatableColumns(table).stream()
                .map(column -> column + " = s." + column)
                .toList());
        String sql = """
                UPDATE %s t
                   SET %s
                  FROM jsonb_populate_record(NULL::%s, ?::jsonb) s
                 WHERE t.id = ? AND t.updated_at <= ?
                """.formatted(table, setClause, table);
        return jdbc.update(sql, beforeJson, targetId, importedAt) > 0;
    }

    /**
     * 逻辑删除本批次新增的行（规则 RB2 的「新增的删除」；F5／SEC2 全系统逻辑删除）。
     *
     * @return true 已删除；false 已被后续修改或已删除，跳过
     */
    public boolean logicalDelete(String table, long targetId, OffsetDateTime importedAt, String operator) {
        checkIdentifier(table);
        String sql = """
                UPDATE %s
                   SET deleted = TRUE, updated_at = NOW(), updated_by = ?
                 WHERE id = ? AND deleted = FALSE AND updated_at <= ?
                """.formatted(table);
        return jdbc.update(sql, operator, targetId, importedAt) > 0;
    }

    /** 目标表可赋值的列：排除主键与生成列。生成列出现在 SET 子句里会直接报错。 */
    private List<String> updatableColumns(String table) {
        return updatableColumns.computeIfAbsent(table, name -> {
            List<String> columns = jdbc.queryForList("""
                    SELECT column_name
                      FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = ?
                       AND is_generated = 'NEVER'
                       AND column_name <> 'id'
                     ORDER BY ordinal_position
                    """, String.class, name);
            if (columns.isEmpty()) {
                throw new IllegalArgumentException("未知的目标表：" + name);
            }
            columns.forEach(RowSnapshotRepository::checkIdentifier);
            return columns;
        });
    }

    private static void checkIdentifier(String identifier) {
        if (identifier == null || !IDENTIFIER.matcher(identifier).matches()) {
            throw new IllegalArgumentException("非法的库标识符：" + identifier);
        }
    }

    /** 供撤销日志与测试统计本批次共写了多少行。 */
    public int countByBatch(String batchNo) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM import_row_snapshot WHERE batch_no = ?", Integer.class, batchNo);
        return count == null ? 0 : count;
    }

    /** 仅供测试：断言某批次的快照动作分布。 */
    public int countByBatchAndOp(String batchNo, RowOp op) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM import_row_snapshot WHERE batch_no = ? AND op = ?",
                Integer.class, batchNo, op.name());
        return count == null ? 0 : count;
    }
}
