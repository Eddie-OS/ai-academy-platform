package com.aiacademy.business.course.repository;

import com.aiacademy.business.course.domain.CourseTrial;
import com.aiacademy.business.course.domain.CourseTrialCalendarItem;
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

    /**
     * 试讲日历：官方试讲日期 + 台账预定日期。同一天同一门课只留官方记录。
     *
     * <p>不 JOIN {@code biz_lecturer}（AR-1）。官方记录的讲师姓名由 app 层补。
     */
    @Select("""
            SELECT t.trial_date AS trial_date,
                   c.id AS course_id,
                   c.course_name AS course_name,
                   t.round_no AS round_no,
                   CAST(NULL AS VARCHAR) AS round_label,
                   t.lecturer_id AS lecturer_id,
                   CAST(NULL AS VARCHAR) AS lecturer_name,
                   t.participants AS audience_count
              FROM dtl_course_trial t
              JOIN biz_course c ON c.id = t.course_id AND c.deleted = FALSE
             WHERE t.deleted = FALSE
               AND t.trial_date BETWEEN #{from} AND #{to}
            UNION ALL
            SELECT c.trial_scheduled_date,
                   c.id,
                   c.course_name,
                   CAST(NULL AS INT),
                   c.trial_round_label,
                   CAST(NULL AS BIGINT),
                   e.employee_name,
                   c.trial_audience_count
              FROM biz_course c
              LEFT JOIN org_employee e ON e.employee_no = c.trial_lecturer_no AND e.deleted = FALSE
             WHERE c.deleted = FALSE
               AND c.trial_scheduled_date BETWEEN #{from} AND #{to}
               AND NOT EXISTS (
                    SELECT 1 FROM dtl_course_trial t
                     WHERE t.course_id = c.id AND t.deleted = FALSE
                       AND t.trial_date = c.trial_scheduled_date)
             ORDER BY 1, 3
            """)
    List<CourseTrialCalendarItem> calendar(@Param("from") LocalDate from,
                                           @Param("to") LocalDate to);
}
