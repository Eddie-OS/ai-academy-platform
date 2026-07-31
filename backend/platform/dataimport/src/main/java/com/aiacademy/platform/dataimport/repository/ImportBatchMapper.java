package com.aiacademy.platform.dataimport.repository;

import com.aiacademy.platform.dataimport.domain.ImportBatch;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;
import java.util.List;

@Mapper
public interface ImportBatchMapper {

    /**
     * 建批次。批次号在<b>上传解析阶段</b>生成（开发 5.6.3 细节五），不在确认写入时生成——
     * 前端拿着它来确认，服务端才有幂等键可判。
     *
     * <p>用 {@code @Select ... RETURNING id} 而不是 {@code @Insert}：MyBatis 的
     * {@code useGeneratedKeys} 要往参数对象里回填主键，而这里的参数是不可变 record。
     * PostgreSQL 的 {@code RETURNING} 让插入本身就是一次查询，比为了取 ID 而放弃 record 更划算。
     */
    @Select("""
            INSERT INTO import_batch (batch_no, import_type, file_name, source_path, total_rows,
                                      insert_rows, update_rows, batch_state, import_result,
                                      error_report_path, created_by)
            VALUES (#{batchNo}, #{importType}, #{fileName}, #{sourcePath}, #{totalRows},
                    #{insertRows}, #{updateRows}, #{batchState}, #{importResult},
                    #{errorReportPath}, #{operator})
            RETURNING id
            """)
    long insertBatch(@Param("batchNo") String batchNo,
                     @Param("importType") String importType,
                     @Param("fileName") String fileName,
                     @Param("sourcePath") String sourcePath,
                     @Param("totalRows") int totalRows,
                     @Param("insertRows") int insertRows,
                     @Param("updateRows") int updateRows,
                     @Param("batchState") String batchState,
                     @Param("importResult") String importResult,
                     @Param("errorReportPath") String errorReportPath,
                     @Param("operator") String operator);

    @Select("SELECT * FROM import_batch WHERE batch_no = #{batchNo} AND deleted = FALSE")
    ImportBatch findByNo(@Param("batchNo") String batchNo);

    /**
     * 确认写入：待确认 → 已写入（规则 I8、K3）。
     *
     * <p><b>这一条 UPDATE 就是幂等的全部实现。</b>{@code WHERE batch_state = '待确认'} 让重复提交
     * 更新到 0 行，调用方据此返回 {@code DUPLICATE_SUBMIT}。判断与更新在同一条语句里，
     * 因此不存在「先查后写」的竞态——两个并发的确认请求里只有一个能更新成功。
     *
     * <p>{@code imported_at = NOW()} 是写入时刻，与本批次写入的行的 {@code updated_at} 同值
     * （PostgreSQL 的 NOW() 在一个事务内是常量），规则 RB3 的「是否被后续修改过」靠这个相等性成立。
     */
    @Update("""
            UPDATE import_batch
               SET batch_state = '已写入',
                   import_result = '成功',
                   total_rows = #{totalRows},
                   insert_rows = #{insertRows},
                   update_rows = #{updateRows},
                   imported_at = NOW(),
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE batch_no = #{batchNo}
               AND batch_state = '待确认'
               AND import_result IS NULL
               AND deleted = FALSE
            """)
    int markWritten(@Param("batchNo") String batchNo,
                    @Param("totalRows") int totalRows,
                    @Param("insertRows") int insertRows,
                    @Param("updateRows") int updateRows,
                    @Param("operator") String operator);

    /**
     * 撤销：成功 → 已撤销。
     *
     * <p>{@code WHERE import_result = '成功'} 同时挡住两种非法撤销：已撤销的批次不可重复撤销
     * （规则 RB4），校验失败的批次没有数据可撤（规则 RB6）。
     */
    @Update("""
            UPDATE import_batch
               SET import_result = '已撤销',
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE batch_no = #{batchNo}
               AND import_result = '成功'
               AND deleted = FALSE
            """)
    int markRevoked(@Param("batchNo") String batchNo, @Param("operator") String operator);

    @Update("""
            UPDATE import_batch
               SET import_result = '校验失败',
                   total_rows = #{totalRows},
                   error_report_path = #{errorReportPath},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE batch_no = #{batchNo} AND deleted = FALSE
            """)
    int markValidationFailed(@Param("batchNo") String batchNo,
                             @Param("totalRows") int totalRows,
                             @Param("errorReportPath") String errorReportPath,
                             @Param("operator") String operator);

    /**
     * 批次列表（需求 13.8.4）。默认按导入时间倒序。
     *
     * <p>只列 {@code import_result} 非空的批次：上传后未确认的「待确认」批次是运营中途退出向导留下
     * 的，需求 13.8.3 明确「退出后不保留上传文件，需重新开始」，把它们列出来只会让人以为有半成品
     * 可以接着做。
     */
    @Select("""
            <script>
            SELECT * FROM import_batch
             WHERE deleted = FALSE AND import_result IS NOT NULL
            <if test="importType != null"> AND import_type = #{importType}</if>
            <if test="importResult != null"> AND import_result = #{importResult}</if>
            <if test="from != null"> AND COALESCE(imported_at, created_at) &gt;= #{from}</if>
            <if test="to != null"> AND COALESCE(imported_at, created_at) &lt;= #{to}</if>
             ORDER BY COALESCE(imported_at, created_at) DESC, id DESC
             LIMIT #{limit} OFFSET #{offset}
            </script>
            """)
    List<ImportBatch> list(@Param("importType") String importType,
                           @Param("importResult") String importResult,
                           @Param("from") OffsetDateTime from,
                           @Param("to") OffsetDateTime to,
                           @Param("limit") int limit,
                           @Param("offset") int offset);

    @Select("""
            <script>
            SELECT COUNT(*) FROM import_batch
             WHERE deleted = FALSE AND import_result IS NOT NULL
            <if test="importType != null"> AND import_type = #{importType}</if>
            <if test="importResult != null"> AND import_result = #{importResult}</if>
            <if test="from != null"> AND COALESCE(imported_at, created_at) &gt;= #{from}</if>
            <if test="to != null"> AND COALESCE(imported_at, created_at) &lt;= #{to}</if>
            </script>
            """)
    long count(@Param("importType") String importType,
               @Param("importResult") String importResult,
               @Param("from") OffsetDateTime from,
               @Param("to") OffsetDateTime to);
}
