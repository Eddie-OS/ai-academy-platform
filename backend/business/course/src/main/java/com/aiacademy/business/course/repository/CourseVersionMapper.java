package com.aiacademy.business.course.repository;

import com.aiacademy.business.course.domain.CourseMaterialVersion;
import com.aiacademy.business.course.domain.CourseMaterialVersionFile;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 材料版本快照（需求 9.5，规则 R7）。
 *
 * <p>快照复制的是<b>元数据</b>，磁盘上的文件不复制。R7 要的是「历史评审记录永远指向当时的材料」，
 * 而附件是逻辑删除、文件永不物理删除（规则 F5），元数据副本就足以还原当时那份清单。
 * 复制文件会让 200MB 的课件在每次提交评审时翻一倍。
 */
@Mapper
public interface CourseVersionMapper {

    /**
     * 下一个版本号：V + 递增整数（需求 9.5.1）。
     *
     * <p>按已有版本行数 + 1 而不是解析最大版本号：版本行只增不删（历史版本不允许删除，否则
     * 绑定它的评审记录会指向不存在的版本），行数就是可靠的递增源。
     */
    @Select("""
            SELECT 'V' || (COUNT(*) + 1) FROM dtl_course_material_version
             WHERE course_id = #{courseId} AND deleted = FALSE
            """)
    String nextVersionNo(@Param("courseId") long courseId);

    @Select("""
            INSERT INTO dtl_course_material_version (course_id, version_no, trigger_type, remark,
                                                     created_by, updated_by)
            VALUES (#{courseId}, #{versionNo}, #{triggerType}, #{remark}, #{operator}, #{operator})
            RETURNING id
            """)
    long insertVersion(@Param("courseId") long courseId,
                       @Param("versionNo") String versionNo,
                       @Param("triggerType") String triggerType,
                       @Param("remark") String remark,
                       @Param("operator") String operator);

    /**
     * 把当前材料整份复制进版本（规则 R7）。
     *
     * <p>用 {@code INSERT ... SELECT} 一条语句完成，而不是查出来再逐条插：快照必须是某一时刻的
     * 一致视图，分两步做的话，两步之间有人加了一个附件，快照里就会出现半新半旧的清单。
     *
     * @return 复制的文件数。0 表示课程当时没有任何材料——这是允许的（材料全是选填），
     *         版本行照样产生，评审记录绑定的就是一个空版本
     */
    @Select("""
            WITH copied AS (
                INSERT INTO dtl_course_material_version_file
                    (version_id, material_type, attachment_id, file_name_snapshot, seq_no,
                     created_by, updated_by)
                SELECT #{versionId}, m.material_type, m.attachment_id, a.file_name, m.seq_no,
                       #{operator}, #{operator}
                  FROM dtl_course_material m
                  JOIN sys_attachment a ON a.id = m.attachment_id
                 WHERE m.course_id = #{courseId} AND m.deleted = FALSE AND a.deleted = FALSE
                RETURNING id
            )
            SELECT COUNT(*) FROM copied
            """)
    int copyCurrentMaterials(@Param("courseId") long courseId,
                             @Param("versionId") long versionId,
                             @Param("operator") String operator);

    /**
     * 自检结果一并快照（需求 9.4.3 规则 CK4）。
     *
     * <p>「否则评审后修改自检会导致评审意见与自检内容错位」——评审意见里写的「自检第 3 项没勾」
     * 在运营补勾之后就成了一句对不上的话。
     *
     * @return 复制的条目数。课程还没做自检时为 0
     */
    @Select("""
            WITH copied AS (
                INSERT INTO dtl_selfcheck_snapshot
                    (version_id, item_id, item_text_snapshot, checked, note, seq_no,
                     created_by, updated_by)
                SELECT #{versionId}, s.item_id, s.item_text_snapshot, s.checked, s.note,
                       ROW_NUMBER() OVER (ORDER BY s.item_id), #{operator}, #{operator}
                  FROM dtl_course_selfcheck s
                 WHERE s.course_id = #{courseId} AND s.deleted = FALSE
                RETURNING id
            )
            SELECT COUNT(*) FROM copied
            """)
    int copySelfcheck(@Param("courseId") long courseId,
                      @Param("versionId") long versionId,
                      @Param("operator") String operator);

    /**
     * 版本历史（需求 9.5.3 的下区列表），最新的在前。
     *
     * <p>绑定的评审轮次由 {@code dtl_course_review.version_id} 反查——一个版本至多被一轮评审
     * 绑定（每次提交评审都会先产生新版本），因此这里用标量子查询而不是 JOIN。
     */
    @Select("""
            SELECT v.id, v.course_id, v.version_no, v.trigger_type, v.remark,
                   (SELECT r.round_no FROM dtl_course_review r
                     WHERE r.version_id = v.id AND r.deleted = FALSE
                     ORDER BY r.round_no LIMIT 1) AS bound_review_round,
                   v.version_label, v.version_status, v.owner_no, v.updated_date,
                   v.courseware_url, v.recording_url,
                   v.created_at, v.created_by
              FROM dtl_course_material_version v
             WHERE v.course_id = #{courseId} AND v.deleted = FALSE
             ORDER BY v.id DESC
            """)
    List<CourseMaterialVersion> findVersions(@Param("courseId") long courseId);

    @Select("""
            SELECT v.id, v.course_id, v.version_no, v.trigger_type, v.remark,
                   (SELECT r.round_no FROM dtl_course_review r
                     WHERE r.version_id = v.id AND r.deleted = FALSE
                     ORDER BY r.round_no LIMIT 1) AS bound_review_round,
                   v.version_label, v.version_status, v.owner_no, v.updated_date,
                   v.courseware_url, v.recording_url,
                   v.created_at, v.created_by
              FROM dtl_course_material_version v
             WHERE v.id = #{versionId} AND v.course_id = #{courseId} AND v.deleted = FALSE
            """)
    CourseMaterialVersion findByCourseAndId(@Param("courseId") long courseId,
                                            @Param("versionId") long versionId);

    @Update("""
            UPDATE dtl_course_material_version
               SET version_label = #{versionLabel},
                   version_status = #{versionStatus},
                   owner_no = #{ownerNo},
                   updated_date = #{updatedDate},
                   courseware_url = #{coursewareUrl},
                   recording_url = #{recordingUrl},
                   remark = #{remark},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{versionId} AND course_id = #{courseId} AND deleted = FALSE
            """)
    int updateLedger(@Param("courseId") long courseId,
                     @Param("versionId") long versionId,
                     @Param("versionLabel") String versionLabel,
                     @Param("versionStatus") String versionStatus,
                     @Param("ownerNo") String ownerNo,
                     @Param("updatedDate") LocalDate updatedDate,
                     @Param("coursewareUrl") String coursewareUrl,
                     @Param("recordingUrl") String recordingUrl,
                     @Param("remark") String remark,
                     @Param("operator") String operator);

    @Select("""
            SELECT f.id, f.version_id, f.material_type, f.attachment_id, f.file_name_snapshot,
                   f.seq_no, a.deleted AS attachment_deleted
              FROM dtl_course_material_version_file f
              LEFT JOIN sys_attachment a ON a.id = f.attachment_id
             WHERE f.version_id = #{versionId} AND f.deleted = FALSE
             ORDER BY f.material_type, f.seq_no, f.id
            """)
    List<CourseMaterialVersionFile> findVersionFiles(@Param("versionId") long versionId);

    /** 某版本快照下来的自检结果（CK4）。键顺序即展示顺序。 */
    @Select("""
            SELECT item_text_snapshot, checked, note
              FROM dtl_selfcheck_snapshot
             WHERE version_id = #{versionId} AND deleted = FALSE
             ORDER BY seq_no, id
            """)
    List<Map<String, Object>> findSelfcheckSnapshot(@Param("versionId") long versionId);

    @Select("""
            SELECT v.id, v.course_id, v.version_no, v.trigger_type, v.remark, NULL AS bound_review_round,
                   v.version_label, v.version_status, v.owner_no, v.updated_date,
                   v.courseware_url, v.recording_url,
                   v.created_at, v.created_by
              FROM dtl_course_material_version v
             WHERE v.course_id = #{courseId} AND v.deleted = FALSE
             ORDER BY v.id DESC LIMIT 1
            """)
    CourseMaterialVersion findLatest(@Param("courseId") long courseId);
}
