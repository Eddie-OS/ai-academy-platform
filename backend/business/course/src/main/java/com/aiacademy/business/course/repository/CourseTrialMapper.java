package com.aiacademy.business.course.repository;

import com.aiacademy.business.course.domain.CourseTrial;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

/**
 * 试讲记录（需求 9.7.1，规则 R6）。
 *
 * <p>与评审记录一样<b>没有删除方法</b>：需求 9.8 规定已完成的评审记录与试讲记录任何角色不可
 * 修改、不可删除，要更正只能新增一轮并在意见里说明。
 *
 * <p>{@code inconsistent} 不在任何写方法里——它是数据库生成列（开发 6.3.4），写它会直接报错。
 */
@Mapper
public interface CourseTrialMapper {

    String COLUMNS = """
            id, course_id, round_no, trial_date, lecturer_id, participants,
            acceptance_checks::text AS acceptance_checks, course_conclusion, lecturer_conclusion,
            inconsistent, expert_opinion, issue_list, record_state,
            created_at, created_by, updated_at, updated_by
            """;

    /** 调用前先锁课程行，理由同评审轮次：并发的两次「新建试讲」不能算出同一轮。 */
    @Select("""
            SELECT COUNT(*) + 1 FROM dtl_course_trial
             WHERE course_id = #{courseId} AND deleted = FALSE
            """)
    int nextRoundNo(@Param("courseId") long courseId);

    @Select("""
            INSERT INTO dtl_course_trial (course_id, round_no, trial_date, lecturer_id, participants,
                                          record_state, created_by, updated_by)
            VALUES (#{courseId}, #{roundNo}, #{trialDate}, #{lecturerId}, #{participants},
                    #{recordState}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("courseId") long courseId,
                @Param("roundNo") int roundNo,
                @Param("trialDate") LocalDate trialDate,
                @Param("lecturerId") long lecturerId,
                @Param("participants") String participants,
                @Param("recordState") String recordState,
                @Param("operator") String operator);

    /**
     * 录入双结论与意见（需求 9.7.1 第 7～12 项）。
     *
     * <p>记录状态写在 WHERE 里：已完成的记录不允许再改（需求 9.8）。{@code expectedState} 由调用方
     * 从状态机取，不写死在 SQL 文本里（出口准则 E2-6）——写死的话转换表改了状态名不会报错，
     * 只会一行都更新不到。
     */
    @Update("""
            UPDATE dtl_course_trial
               SET acceptance_checks = #{acceptanceChecks}::jsonb,
                   course_conclusion = #{courseConclusion},
                   lecturer_conclusion = #{lecturerConclusion},
                   expert_opinion = #{expertOpinion},
                   issue_list = #{issueList},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE AND record_state = #{expectedState}
            """)
    int recordConclusion(@Param("id") long id,
                         @Param("acceptanceChecks") String acceptanceChecks,
                         @Param("courseConclusion") String courseConclusion,
                         @Param("lecturerConclusion") String lecturerConclusion,
                         @Param("expertOpinion") String expertOpinion,
                         @Param("issueList") String issueList,
                         @Param("operator") String operator,
                         @Param("expectedState") String expectedState);

    @Select("SELECT " + COLUMNS + " FROM dtl_course_trial WHERE id = #{id} AND deleted = FALSE")
    CourseTrial findById(@Param("id") long id);

    @Select("SELECT " + COLUMNS + """
             FROM dtl_course_trial
             WHERE course_id = #{courseId} AND deleted = FALSE
             ORDER BY round_no DESC
            """)
    List<CourseTrial> findByCourse(@Param("courseId") long courseId);
}
