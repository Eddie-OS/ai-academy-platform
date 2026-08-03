package com.aiacademy.business.course.repository;

import com.aiacademy.business.course.domain.CourseMaterial;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 课程材料的当前版本（需求 9.3.3）。
 *
 * <p>课程材料走这张专表而不是通用的 {@code sys_attachment_ref}，因为它要参与版本快照（规则 R7）：
 * 快照要按「课件 / 教案 / 实验材料」分类复制一份元数据，而通用引用表里的分类只是一个字符串字段，
 * 没有约束。
 */
@Mapper
public interface CourseMaterialMapper {

    /**
     * 某门课程的当前材料，按类型与展示顺序排列。
     *
     * <p>文件名与大小从附件表带出。{@code JOIN} 不带 {@code a.deleted = FALSE}：附件被逻辑删除后
     * 这一行应当消失（当前材料就是当前有效的文件），但删除判断放在 WHERE 上比放在 JOIN 上更明确。
     */
    @Select("""
            SELECT m.id, m.course_id, m.material_type, m.attachment_id,
                   a.file_name, a.file_size, m.seq_no, m.created_at, m.created_by
              FROM dtl_course_material m
              JOIN sys_attachment a ON a.id = m.attachment_id
             WHERE m.course_id = #{courseId} AND m.deleted = FALSE AND a.deleted = FALSE
             ORDER BY m.material_type, m.seq_no, m.id
            """)
    List<CourseMaterial> findByCourse(@Param("courseId") long courseId);

    @Select("""
            SELECT m.id, m.course_id, m.material_type, m.attachment_id,
                   a.file_name, a.file_size, m.seq_no, m.created_at, m.created_by
              FROM dtl_course_material m
              JOIN sys_attachment a ON a.id = m.attachment_id
             WHERE m.id = #{id} AND m.deleted = FALSE
            """)
    CourseMaterial findById(@Param("id") long id);

    /** 同一课程同一类型下的下一个展示序号。并发下可能重号，但序号只影响展示顺序，不值得加锁。 */
    @Select("""
            SELECT COALESCE(MAX(seq_no), -1) + 1 FROM dtl_course_material
             WHERE course_id = #{courseId} AND material_type = #{materialType} AND deleted = FALSE
            """)
    int nextSeqNo(@Param("courseId") long courseId, @Param("materialType") String materialType);

    @Select("""
            INSERT INTO dtl_course_material (course_id, material_type, attachment_id, seq_no,
                                             created_by, updated_by)
            VALUES (#{courseId}, #{materialType}, #{attachmentId}, #{seqNo}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("courseId") long courseId,
                @Param("materialType") String materialType,
                @Param("attachmentId") long attachmentId,
                @Param("seqNo") int seqNo,
                @Param("operator") String operator);

    /** 同一附件在同一门课程同一类型下只挂一次。重复挂载多半是前端重复提交。 */
    @Select("""
            SELECT COUNT(*) FROM dtl_course_material
             WHERE course_id = #{courseId} AND material_type = #{materialType}
               AND attachment_id = #{attachmentId} AND deleted = FALSE
            """)
    long countSame(@Param("courseId") long courseId,
                   @Param("materialType") String materialType,
                   @Param("attachmentId") long attachmentId);

    /**
     * 移除一个材料引用（逻辑删除）。
     *
     * <p><b>不删附件本身</b>（规则 F5）：历史版本快照仍指向同一个附件行，物理删除会直接破坏 R7，
     * 表现为一年前的评审记录点开材料是 404。
     */
    @Update("""
            UPDATE dtl_course_material
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND course_id = #{courseId} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id,
                   @Param("courseId") long courseId,
                   @Param("operator") String operator);
}
