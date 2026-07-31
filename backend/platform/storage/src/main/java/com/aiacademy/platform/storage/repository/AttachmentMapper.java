package com.aiacademy.platform.storage.repository;

import com.aiacademy.platform.storage.domain.Attachment;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;
import java.util.List;

@Mapper
public interface AttachmentMapper {

    /**
     * 先取 ID 再落库：存储路径里含附件ID（开发 5.7.3 的 {@code {附件ID}_{原始文件名}}），
     * 因此 ID 必须在写文件之前就确定。
     */
    @Select("SELECT nextval(pg_get_serial_sequence('sys_attachment', 'id'))")
    long nextId();

    @Insert("""
            INSERT INTO sys_attachment (id, file_name, file_size, content_type, storage_path,
                                        sha256, created_by)
            VALUES (#{id}, #{fileName}, #{fileSize}, #{contentType}, #{storagePath},
                    #{sha256}, #{operator})
            """)
    void insert(@Param("id") long id,
                @Param("fileName") String fileName,
                @Param("fileSize") long fileSize,
                @Param("contentType") String contentType,
                @Param("storagePath") String storagePath,
                @Param("sha256") String sha256,
                @Param("operator") String operator);

    @Select("""
            SELECT id, file_name, file_size, content_type, storage_path, sha256,
                   created_at, created_by, deleted
              FROM sys_attachment
             WHERE id = #{id}
            """)
    Attachment findById(@Param("id") long id);

    /** 逻辑删除（规则 F5）。文件不动——历史版本快照可能仍引用同一个文件对象。 */
    @Update("""
            UPDATE sys_attachment
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int markDeleted(@Param("id") long id, @Param("operator") String operator);

    /**
     * 孤儿附件（TD-7.2）：超过 {@code before} 仍未被任何业务对象引用的。
     *
     * <p>判定只看 {@code sys_attachment_ref}，这正是那张表存在的理由：引用关系若散落在各业务表的
     * JSONB 列里，将来新增一个附件字段却漏改这条查询，后果是<b>被引用的文件被物理删除</b>。
     */
    @Select("""
            SELECT a.id, a.file_name, a.file_size, a.content_type, a.storage_path, a.sha256,
                   a.created_at, a.created_by, a.deleted
              FROM sys_attachment a
             WHERE a.created_at < #{before}
               AND NOT EXISTS (SELECT 1 FROM sys_attachment_ref r
                                WHERE r.attachment_id = a.id AND r.deleted = FALSE)
             ORDER BY a.id
            """)
    List<Attachment> findOrphans(@Param("before") OffsetDateTime before);

    /**
     * 物理删除孤儿附件的元数据行。
     *
     * <p>与规则 F5「逻辑删除」不冲突：F5 保护的是被业务引用过的附件（历史评审记录还要能下载它）。
     * 孤儿从未被任何对象引用，留着它只是让磁盘和表一起长胖，而单机部署下磁盘写满会连带
     * PostgreSQL 一起停（开发 5.7.2）。
     */
    @Delete("DELETE FROM sys_attachment WHERE id = #{id}")
    int purge(@Param("id") long id);

    // -------------------------------------------------------------------------
    // 引用关系
    // -------------------------------------------------------------------------

    /** 重复关联同一附件到同一位置是幂等的（唯一约束 uk_attachment_ref）。 */
    @Insert("""
            INSERT INTO sys_attachment_ref (attachment_id, ref_type, ref_id, ref_field, seq_no, created_by)
            VALUES (#{attachmentId}, #{refType}, #{refId}, #{refField}, #{seqNo}, #{operator})
            ON CONFLICT (ref_type, ref_id, ref_field, attachment_id)
            DO UPDATE SET deleted = FALSE, seq_no = #{seqNo}, updated_at = NOW(), updated_by = #{operator}
            """)
    void linkRef(@Param("attachmentId") long attachmentId,
                 @Param("refType") String refType,
                 @Param("refId") long refId,
                 @Param("refField") String refField,
                 @Param("seqNo") int seqNo,
                 @Param("operator") String operator);

    @Update("""
            UPDATE sys_attachment_ref
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE ref_type = #{refType} AND ref_id = #{refId} AND ref_field = #{refField}
               AND attachment_id = #{attachmentId} AND deleted = FALSE
            """)
    int unlinkRef(@Param("attachmentId") long attachmentId,
                  @Param("refType") String refType,
                  @Param("refId") long refId,
                  @Param("refField") String refField,
                  @Param("operator") String operator);

    /** 某对象某字段下的附件列表，按展示顺序。已逻辑删除的附件不返回（规则 F5 的删除语义）。 */
    @Select("""
            SELECT a.id, a.file_name, a.file_size, a.content_type, a.storage_path, a.sha256,
                   a.created_at, a.created_by, a.deleted
              FROM sys_attachment_ref r
              JOIN sys_attachment a ON a.id = r.attachment_id
             WHERE r.ref_type = #{refType} AND r.ref_id = #{refId} AND r.ref_field = #{refField}
               AND r.deleted = FALSE AND a.deleted = FALSE
             ORDER BY r.seq_no, r.id
            """)
    List<Attachment> findByRef(@Param("refType") String refType,
                               @Param("refId") long refId,
                               @Param("refField") String refField);

    @Select("""
            SELECT COUNT(*) FROM sys_attachment_ref
             WHERE attachment_id = #{attachmentId} AND deleted = FALSE
            """)
    int countRefs(@Param("attachmentId") long attachmentId);
}
