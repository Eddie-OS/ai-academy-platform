package com.aiacademy.business.lecturer.repository;

import com.aiacademy.business.lecturer.domain.LevelLogRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface LevelLogMapper {

    String COLUMNS = """
            id, lecturer_id, change_no, trigger_reason, change_desc, changed_on,
            level_after, reviewer, review_comment,
            created_at, created_by, updated_at, updated_by
            """;

    @Select("SELECT pg_advisory_xact_lock(hashtext('dtl_lecturer_level_log.change_no'))")
    String lockChangeNoSequence();

    @Select("""
            SELECT 'BG' || lpad(next_no, GREATEST(4, LENGTH(next_no)), '0')
              FROM (SELECT (COALESCE(MAX(SUBSTRING(change_no FROM 3)::INT), 0) + 1)::TEXT AS next_no
                      FROM dtl_lecturer_level_log
                     WHERE change_no ~ '^BG[0-9]{1,9}$') t
            """)
    String nextChangeNo();

    @Select("SELECT " + COLUMNS + """
             FROM dtl_lecturer_level_log
             WHERE lecturer_id = #{lecturerId} AND deleted = FALSE
             ORDER BY created_at DESC, id DESC
            """)
    List<LevelLogRecord> listByLecturer(@Param("lecturerId") long lecturerId);

    @Select("SELECT " + COLUMNS + """
             FROM dtl_lecturer_level_log
             WHERE id = #{id} AND lecturer_id = #{lecturerId} AND deleted = FALSE
            """)
    LevelLogRecord find(@Param("id") long id, @Param("lecturerId") long lecturerId);

    @Select("""
            INSERT INTO dtl_lecturer_level_log (
                lecturer_id, change_no, trigger_reason, change_desc, changed_on,
                level_after, reviewer, review_comment, created_by, updated_by)
            VALUES (
                #{r.lecturerId}, #{r.changeNo}, #{r.triggerReason}, #{r.changeDesc}, #{r.changedOn},
                #{r.levelAfter}, #{r.reviewer}, #{r.reviewComment}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("r") LevelLogRecord record, @Param("operator") String operator);

    @Update("""
            UPDATE dtl_lecturer_level_log
               SET trigger_reason = #{r.triggerReason},
                   change_desc = #{r.changeDesc},
                   changed_on = #{r.changedOn},
                   level_after = #{r.levelAfter},
                   reviewer = #{r.reviewer},
                   review_comment = #{r.reviewComment},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{r.id} AND lecturer_id = #{r.lecturerId} AND deleted = FALSE
            """)
    int update(@Param("r") LevelLogRecord record, @Param("operator") String operator);

    @Update("""
            UPDATE dtl_lecturer_level_log
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND lecturer_id = #{lecturerId} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id,
                   @Param("lecturerId") long lecturerId,
                   @Param("operator") String operator);
}
