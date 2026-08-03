package com.aiacademy.business.training.repository;

import com.aiacademy.business.training.domain.TrainingSession;
import com.aiacademy.business.training.domain.TrainingSessionListItem;
import com.aiacademy.business.training.domain.TrainingSessionQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * 培训场次主表的读写。
 *
 * <p><b>{@code session_state} 不在任何写方法里</b>（INSERT 的初始值除外），理由同计划表。
 */
@Mapper
public interface TrainingSessionMapper {

    String COLUMNS = """
            id, session_no, plan_id, session_name, course_id, lecturer_id,
            training_date, start_time, end_time, duration_hours, training_form,
            venue, online_link, student_scope, plan_attendee_count,
            session_state, remark,
            created_at, created_by, updated_at, updated_by, last_state_changed_at, deleted
            """;

    /**
     * 锁住计划行，串行化「本计划下第几场」的计算。
     *
     * <p>不锁就会算出两个 {@code -02}，撞在 {@code uk_training_session_no} 上——共享账号下
     * 两名运营同时给一个计划加场次是常态（CLAUDE.md 第七节），运营看到的是一次没有解释的失败。
     *
     * <p>顺带把计划名称取回来：场次名称留空时要自动生成「计划名称 第N场」（需求 11.4 第 3 项）。
     *
     * @return 计划号与名称；null 表示计划不存在或已逻辑删除
     */
    @Select("""
            SELECT plan_no, plan_name FROM biz_training_plan
             WHERE id = #{planId} AND deleted = FALSE FOR UPDATE
            """)
    PlanRef lockPlanForSessionNo(@Param("planId") long planId);

    record PlanRef(String planNo, String planName) {
    }

    /**
     * 本计划下已用掉的最大场次序号。
     *
     * <p><b>不带 {@code deleted = FALSE}</b>：场次号是三类导入模板的关联键，删掉一场之后把
     * {@code -02} 让给新建的下一场，运营手上那份填了旧 {@code -02} 的表格就会静默地导到
     * 另一场去。序号只增不复用。
     */
    @Select("""
            SELECT COALESCE(MAX(substring(session_no from '-(\\d+)$')::INT), 0)
              FROM biz_training_session WHERE plan_id = #{planId}
            """)
    int maxSessionSeq(@Param("planId") long planId);

    @Select("""
            INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id, lecturer_id,
                                              training_date, start_time, end_time, duration_hours,
                                              training_form, venue, online_link, student_scope,
                                              plan_attendee_count, session_state, remark,
                                              created_by, updated_by)
            VALUES (#{s.sessionNo}, #{s.planId}, #{s.sessionName}, #{s.courseId}, #{s.lecturerId},
                    #{s.trainingDate}, #{s.startTime}, #{s.endTime}, #{s.durationHours},
                    #{s.trainingForm}, #{s.venue}, #{s.onlineLink}, #{s.studentScope},
                    #{s.planAttendeeCount}, #{s.sessionState}, #{s.remark},
                    #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("s") TrainingSession session, @Param("operator") String operator);

    /** 编辑场次。<b>不动 {@code plan_id}</b>：换计划就得换场次号，而那是导入模板的关联键。 */
    @Update("""
            UPDATE biz_training_session
               SET session_name = #{s.sessionName},
                   course_id = #{s.courseId},
                   lecturer_id = #{s.lecturerId},
                   training_date = #{s.trainingDate},
                   start_time = #{s.startTime},
                   end_time = #{s.endTime},
                   duration_hours = #{s.durationHours},
                   training_form = #{s.trainingForm},
                   venue = #{s.venue},
                   online_link = #{s.onlineLink},
                   student_scope = #{s.studentScope},
                   plan_attendee_count = #{s.planAttendeeCount},
                   remark = #{s.remark},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{s.id} AND deleted = FALSE
            """)
    int update(@Param("s") TrainingSession session, @Param("operator") String operator);

    /**
     * 只改培训日期（需求 11.8：日历页支持拖动调整培训日期）。
     *
     * <p>单独一条语句而不是复用 {@link #update}：拖动只带得出一个日期，走整表单更新就得先把
     * 场次读出来再回填十几个字段，中间任何一个字段的默认值处理不当都会静默清空运营填过的内容。
     */
    @Update("""
            UPDATE biz_training_session
               SET training_date = #{trainingDate}, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateTrainingDate(@Param("id") long id,
                           @Param("trainingDate") LocalDate trainingDate,
                           @Param("operator") String operator);

    /** 逻辑删除（SEC2）。 */
    @Update("""
            UPDATE biz_training_session
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id, @Param("operator") String operator);

    @Select("SELECT " + COLUMNS + " FROM biz_training_session WHERE id = #{id} AND deleted = FALSE")
    TrainingSession selectById(@Param("id") long id);

    /** 详情页用，比 {@link #selectById} 多带所属计划号与名称、实际签到人数、是否已导入签到。 */
    @Select("""
            SELECT s.*,
                   p.plan_no, p.plan_name,
                   (SELECT COUNT(*) FROM dtl_attendance a
                     WHERE a.session_id = s.id AND a.deleted = FALSE
                       AND a.attend_status = #{presentStatus}) AS actual_attendee_count,
                   EXISTS (SELECT 1 FROM dtl_attendance a
                            WHERE a.session_id = s.id AND a.deleted = FALSE) AS attendance_imported
              FROM biz_training_session s
              JOIN biz_training_plan p ON p.id = s.plan_id
             WHERE s.id = #{id} AND s.deleted = FALSE
            """)
    TrainingSessionListItem selectDetailById(@Param("id") long id,
                                             @Param("presentStatus") String presentStatus);

    /**
     * 同一讲师同一天的其他场次，用于排课校验三的时段冲突判定（需求 11.4.1 校验三）。
     *
     * <p>时段重叠的判定是 {@code 开始 < 对方结束 AND 结束 > 对方开始}——用闭区间会把「上午
     * 9:00–12:00 与下午 12:00–15:00」判成冲突，而那是最常见的连排。
     *
     * @param excludeSessionId 编辑时排除自己；新建时传 0
     */
    @Select("""
            SELECT session_no, session_name, training_date, start_time, end_time
              FROM biz_training_session
             WHERE deleted = FALSE
               AND lecturer_id = #{lecturerId}
               AND training_date = #{trainingDate}
               AND id <> #{excludeSessionId}
               AND start_time < #{endTime}
               AND end_time > #{startTime}
             ORDER BY start_time
            """)
    List<ConflictSession> findLecturerConflicts(@Param("lecturerId") long lecturerId,
                                                @Param("trainingDate") LocalDate trainingDate,
                                                @Param("startTime") LocalTime startTime,
                                                @Param("endTime") LocalTime endTime,
                                                @Param("excludeSessionId") long excludeSessionId);

    record ConflictSession(String sessionNo, String sessionName, LocalDate trainingDate,
                           LocalTime startTime, LocalTime endTime) {
    }

    /**
     * 场次列表与排期日历（需求 11.9、11.8 P4-1）。SQL 在
     * {@code mapper/TrainingSessionMapper.xml}——与 {@link #countPage} 共用同一段 WHERE。
     */
    List<TrainingSessionListItem> selectPage(@Param("q") TrainingSessionQuery query,
                                             @Param("presentStatus") String presentStatus,
                                             @Param("offset") long offset,
                                             @Param("sortColumn") String sortColumn,
                                             @Param("sortDirection") String sortDirection);

    long countPage(@Param("q") TrainingSessionQuery query);
}
