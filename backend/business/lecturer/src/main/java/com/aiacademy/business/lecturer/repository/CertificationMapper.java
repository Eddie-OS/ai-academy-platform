package com.aiacademy.business.lecturer.repository;

import com.aiacademy.business.lecturer.domain.CertificationRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface CertificationMapper {

    String COLUMNS = """
            id, lecturer_id, cert_batch, lecturer_level, cert_state, reviewers, opinion,
            passed_on, valid_from, valid_to, created_at, created_by, updated_at, updated_by
            """;

    @Select("SELECT " + COLUMNS + """
             FROM dtl_lecturer_certification
             WHERE lecturer_id = #{lecturerId} AND deleted = FALSE
             ORDER BY created_at DESC, id DESC
            """)
    List<CertificationRecord> listByLecturer(@Param("lecturerId") long lecturerId);

    @Select("SELECT " + COLUMNS + """
             FROM dtl_lecturer_certification
             WHERE id = #{id} AND lecturer_id = #{lecturerId} AND deleted = FALSE
            """)
    CertificationRecord find(@Param("id") long id, @Param("lecturerId") long lecturerId);

    @Select("""
            INSERT INTO dtl_lecturer_certification (
                lecturer_id, cert_batch, lecturer_level, cert_state, reviewers, opinion,
                passed_on, valid_from, valid_to, created_by, updated_by)
            VALUES (
                #{r.lecturerId}, #{r.certBatch}, #{r.lecturerLevel}, #{r.certState},
                #{r.reviewers}, #{r.opinion}, #{r.passedOn}, #{r.validFrom}, #{r.validTo},
                #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("r") CertificationRecord record, @Param("operator") String operator);

    @Update("""
            UPDATE dtl_lecturer_certification
               SET cert_batch = #{r.certBatch},
                   lecturer_level = #{r.lecturerLevel},
                   cert_state = #{r.certState},
                   reviewers = #{r.reviewers},
                   opinion = #{r.opinion},
                   passed_on = #{r.passedOn},
                   valid_from = #{r.validFrom},
                   valid_to = #{r.validTo},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{r.id} AND lecturer_id = #{r.lecturerId} AND deleted = FALSE
            """)
    int update(@Param("r") CertificationRecord record, @Param("operator") String operator);

    @Update("""
            UPDATE dtl_lecturer_certification
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND lecturer_id = #{lecturerId} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id,
                   @Param("lecturerId") long lecturerId,
                   @Param("operator") String operator);
}
