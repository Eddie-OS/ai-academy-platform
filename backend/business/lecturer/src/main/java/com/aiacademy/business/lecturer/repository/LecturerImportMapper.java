package com.aiacademy.business.lecturer.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Mapper
public interface LecturerImportMapper {

    /** 已在池（含已移出，只要没被逻辑删除）的讲师，按工号索引。工号是唯一键（需求 14.5 A 列）。 */
    @Select("""
            <script>
            SELECT id, employee_no, lecturer_no
              FROM biz_lecturer
             WHERE deleted = FALSE AND employee_no IN
             <foreach collection="employeeNos" item="no" open="(" separator="," close=")">#{no}</foreach>
            </script>
            """)
    List<LecturerKey> findByEmployeeNos(@Param("employeeNos") Collection<String> employeeNos);

    record LecturerKey(long id, String employeeNo, String lecturerNo) {
    }

    /**
     * 当前最大的讲师ID流水号（讲师ID 规则：JS + 4 位流水，需求 10.3）。
     *
     * <p>含已逻辑删除的行：流水号一旦用过就不再复用，否则「JS0007」会先后指向两个人，
     * 而历史记录里可能还留着旧的那个。
     *
     * <p>{@code WHERE} 里的格式过滤不是多余的：没有它，库里只要出现一个不符合 JS+数字 的讲师ID
     * （测试夹具、人工订正、将来换号规则），{@code ::int} 就会直接报错，讲师导入整个功能不可用。
     */
    @Select("""
            SELECT COALESCE(MAX(SUBSTRING(lecturer_no FROM 3)::int), 0)
              FROM biz_lecturer
             WHERE lecturer_no ~ '^JS[0-9]+$'
            """)
    int maxLecturerSeq();

    /**
     * 新增讲师。
     *
     * <p>三个字段由导入语义固定：{@code join_type = '批量导入'}（表上 CHECK 的三个取值之一）、
     * {@code joined_date} 取导入当天、{@code trial_qualified = FALSE}（试讲合格标记只能由试讲结论
     * 录入产生，导入不能伪造它）。
     */
    @Select("""
            INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                                      expertise_domains, teaching_direction, join_type, joined_date,
                                      training_state, trial_qualified, pool_state, import_batch_no, created_by)
            VALUES (#{lecturerNo}, #{lecturerName}, #{employeeNo}, #{sourceDept},
                    #{expertiseDomains}::jsonb, #{teachingDirection}, '批量导入', #{joinedDate},
                    #{trainingState}, FALSE, #{poolState}, #{batchNo}, #{operator})
            RETURNING id
            """)
    long insertLecturer(@Param("lecturerNo") String lecturerNo,
                        @Param("lecturerName") String lecturerName,
                        @Param("employeeNo") String employeeNo,
                        @Param("sourceDept") String sourceDept,
                        @Param("expertiseDomains") String expertiseDomains,
                        @Param("teachingDirection") String teachingDirection,
                        @Param("joinedDate") LocalDate joinedDate,
                        @Param("trainingState") String trainingState,
                        @Param("poolState") String poolState,
                        @Param("batchNo") String batchNo,
                        @Param("operator") String operator);

    /**
     * 更新讲师（需求 14.5「工号已存在时更新」）。
     *
     * <p><b>不更新 {@code lecturer_no}、{@code join_type}、{@code joined_date}、
     * {@code trial_qualified}、{@code first_qualified_date}</b>：前三个是「首次入池」的事实，
     * 后两个是试讲结论的产物。导入文件里没有这些列，用整行覆盖会把它们清掉。
     */
    @Update("""
            UPDATE biz_lecturer
               SET lecturer_name = #{lecturerName},
                   source_dept = #{sourceDept},
                   expertise_domains = #{expertiseDomains}::jsonb,
                   teaching_direction = #{teachingDirection},
                   training_state = #{trainingState},
                   pool_state = #{poolState},
                   import_batch_no = #{batchNo},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateLecturer(@Param("id") long id,
                       @Param("lecturerName") String lecturerName,
                       @Param("sourceDept") String sourceDept,
                       @Param("expertiseDomains") String expertiseDomains,
                       @Param("teachingDirection") String teachingDirection,
                       @Param("trainingState") String trainingState,
                       @Param("poolState") String poolState,
                       @Param("batchNo") String batchNo,
                       @Param("operator") String operator);
}
