package com.aiacademy.business.lecturer.repository;

import com.aiacademy.business.lecturer.domain.CultivationRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 讲师培养计划与培养记录。SQL 只在这里（AR-5）。
 */
@Mapper
public interface CultivationMapper {

    String COLUMNS = """
            id, lecturer_id, plan_text, planned_from, planned_to,
            cultivation_types::text AS cultivation_types, record_text,
            actual_from, actual_to, plan_state, evaluation, remark,
            created_at, created_by, updated_at, updated_by
            """;

    @Select("SELECT " + COLUMNS + """
             FROM dtl_lecturer_cultivation
             WHERE lecturer_id = #{lecturerId} AND deleted = FALSE
             ORDER BY created_at DESC, id DESC
            """)
    List<CultivationRecord> listByLecturer(@Param("lecturerId") long lecturerId);

    @Select("SELECT " + COLUMNS + """
             FROM dtl_lecturer_cultivation
             WHERE id = #{id} AND lecturer_id = #{lecturerId} AND deleted = FALSE
            """)
    CultivationRecord find(@Param("id") long id, @Param("lecturerId") long lecturerId);

    @Select("""
            INSERT INTO dtl_lecturer_cultivation (
                lecturer_id, plan_text, planned_from, planned_to, cultivation_types,
                record_text, actual_from, actual_to, plan_state, evaluation, remark,
                created_by, updated_by)
            VALUES (
                #{r.lecturerId}, #{r.planText}, #{r.plannedFrom}, #{r.plannedTo},
                #{r.cultivationTypes}::jsonb, #{r.recordText}, #{r.actualFrom}, #{r.actualTo},
                #{r.planState}, #{r.evaluation}, #{r.remark}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("r") CultivationRecord record, @Param("operator") String operator);

    @Update("""
            UPDATE dtl_lecturer_cultivation
               SET plan_text = #{r.planText},
                   planned_from = #{r.plannedFrom},
                   planned_to = #{r.plannedTo},
                   cultivation_types = #{r.cultivationTypes}::jsonb,
                   record_text = #{r.recordText},
                   actual_from = #{r.actualFrom},
                   actual_to = #{r.actualTo},
                   plan_state = #{r.planState},
                   evaluation = #{r.evaluation},
                   remark = #{r.remark},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{r.id} AND lecturer_id = #{r.lecturerId} AND deleted = FALSE
            """)
    int update(@Param("r") CultivationRecord record, @Param("operator") String operator);

    @Update("""
            UPDATE dtl_lecturer_cultivation
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND lecturer_id = #{lecturerId} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id,
                   @Param("lecturerId") long lecturerId,
                   @Param("operator") String operator);
}
