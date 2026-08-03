package com.aiacademy.business.course.repository;

import com.aiacademy.business.course.domain.CourseReview;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

/**
 * 课程评审记录（需求 9.6.1）。
 *
 * <p><b>没有删除方法，也没有改轮次、改绑定版本的方法。</b>需求 9.6.1 表末：「历史记录只读，
 * 任何角色不得修改或删除已完成的评审记录」——这是议题 7「历史不被覆盖」的落点。少写一个
 * DELETE 方法，比在 Service 里加一句 if 更难被绕过。
 */
@Mapper
public interface CourseReviewMapper {

    String COLUMNS = """
            id, course_id, round_no, version_id, bound_version_no, review_forms::text AS review_forms,
            review_date, participants, review_result, review_opinion, issue_list, record_state,
            created_at, created_by, updated_at, updated_by
            """;

    /**
     * 下一个评审轮次 = 已有记录数 + 1（需求 9.6.1 第 3 项，不设上限）。
     *
     * <p>调用前必须先锁课程行。表上的 UNIQUE (course_id, round_no) 是并发下的最后一道防线
     * （开发 6.3.5），不是唯一防线。
     */
    @Select("""
            SELECT COUNT(*) + 1 FROM dtl_course_review
             WHERE course_id = #{courseId} AND deleted = FALSE
            """)
    int nextRoundNo(@Param("courseId") long courseId);

    /**
     * 建一条待录入结论的评审记录。评审形式、日期、结论都由运营随后录入。
     *
     * <p>{@code record_state} 是 {@code NOT NULL}，因此初始状态在这里落库，随后由
     * {@code StateTransitionService.initialize} 补记流转日志——与课程主状态同一套做法。
     */
    @Select("""
            INSERT INTO dtl_course_review (course_id, round_no, version_id, bound_version_no,
                                           review_date, record_state, created_by, updated_by)
            VALUES (#{courseId}, #{roundNo}, #{versionId}, #{boundVersionNo},
                    CURRENT_DATE, #{recordState}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("courseId") long courseId,
                @Param("roundNo") int roundNo,
                @Param("versionId") Long versionId,
                @Param("boundVersionNo") String boundVersionNo,
                @Param("recordState") String recordState,
                @Param("operator") String operator);

    /**
     * 录入评审结论（需求 9.6.1 第 5～10 项）。
     *
     * <p>记录状态写在 WHERE 里：已完成的记录不允许再改（议题 7）。状态列本身不在 SET 里——它由状态机写。
     *
     * <p>{@code expectedState} 由调用方从状态机取，不写死在 SQL 文本里（出口准则 E2-6）。
     * SQL 里的状态字面量比 Java 里的 if 判断更隐蔽：转换表改了状态名它不会报错，只会静默地
     * 一行都更新不到，症状是「录入结论没反应」。
     */
    @Update("""
            UPDATE dtl_course_review
               SET review_forms = #{reviewForms}::jsonb,
                   review_date = #{reviewDate},
                   participants = #{participants},
                   review_result = #{reviewResult},
                   review_opinion = #{reviewOpinion},
                   issue_list = #{issueList},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE AND record_state = #{expectedState}
            """)
    int recordConclusion(@Param("id") long id,
                         @Param("reviewForms") String reviewForms,
                         @Param("reviewDate") LocalDate reviewDate,
                         @Param("participants") String participants,
                         @Param("reviewResult") String reviewResult,
                         @Param("reviewOpinion") String reviewOpinion,
                         @Param("issueList") String issueList,
                         @Param("operator") String operator,
                         @Param("expectedState") String expectedState);

    @Select("SELECT " + COLUMNS + " FROM dtl_course_review WHERE id = #{id} AND deleted = FALSE")
    CourseReview findById(@Param("id") long id);

    /** 需求 9.6.1 界面要求：时间倒序展示。 */
    @Select("SELECT " + COLUMNS + """
             FROM dtl_course_review
             WHERE course_id = #{courseId} AND deleted = FALSE
             ORDER BY round_no DESC
            """)
    List<CourseReview> findByCourse(@Param("courseId") long courseId);
}
