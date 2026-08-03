package com.aiacademy.business.course.repository;

import com.aiacademy.business.course.domain.CourseCalendarItem;
import com.aiacademy.business.course.domain.CourseSchedule;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/**
 * 课程排期（需求 9.9）。
 */
@Mapper
public interface CourseScheduleMapper {

    String COLUMNS = "id, course_id, node_name, plan_date, remark, created_at, created_by, "
            + "updated_at, updated_by";

    @Select("SELECT " + COLUMNS + """
             FROM dtl_course_schedule
             WHERE course_id = #{courseId} AND deleted = FALSE
             ORDER BY plan_date, id
            """)
    List<CourseSchedule> findByCourse(@Param("courseId") long courseId);

    @Select("SELECT " + COLUMNS + " FROM dtl_course_schedule WHERE id = #{id} AND deleted = FALSE")
    CourseSchedule findById(@Param("id") long id);

    @Select("""
            INSERT INTO dtl_course_schedule (course_id, node_name, plan_date, remark,
                                             created_by, updated_by)
            VALUES (#{courseId}, #{nodeName}, #{planDate}, #{remark}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("courseId") long courseId,
                @Param("nodeName") String nodeName,
                @Param("planDate") LocalDate planDate,
                @Param("remark") String remark,
                @Param("operator") String operator);

    @Update("""
            UPDATE dtl_course_schedule
               SET node_name = #{nodeName}, plan_date = #{planDate}, remark = #{remark},
                   updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int update(@Param("id") long id,
               @Param("nodeName") String nodeName,
               @Param("planDate") LocalDate planDate,
               @Param("remark") String remark,
               @Param("operator") String operator);

    @Update("""
            UPDATE dtl_course_schedule
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id, @Param("operator") String operator);

    /**
     * 日历数据（需求 9.9）：区间内的开发节点 + 预计发布时间，两类事件合成一个列表。
     *
     * <p>用 {@code UNION ALL} 而不是在应用层查两次再拼：日历是按日期区间取的，两次查询在应用层
     * 合并之后还要重新排序，而排序键正是数据库刚刚算过的那一列。
     *
     * <p><b>已关闭与已归档的课程不出现在日历上。</b>它们的计划日期已经没有意义，留在日历里只会
     * 让运营每个月都看到一批不需要管的条目。终态集合由调用方从课程主状态机取，不在这里抄一份
     * 状态值——抄的那份不会随转换表一起改。
     */
    @Select("""
            <script>
            SELECT c.id AS course_id, c.course_no, c.course_name, c.owner_no,
                   e.employee_name AS owner_name, c.main_state, c.expect_publish_date,
                   '开发节点' AS event_type, s.plan_date AS event_date, s.node_name,
                   s.id AS schedule_id, NULL AS warning_light
              FROM dtl_course_schedule s
              JOIN biz_course c ON c.id = s.course_id AND c.deleted = FALSE
              LEFT JOIN org_employee e ON e.employee_no = c.owner_no AND e.deleted = FALSE
             WHERE s.deleted = FALSE
               AND s.plan_date BETWEEN #{from} AND #{to}
               AND c.main_state NOT IN
                   <foreach item="state" collection="terminalStates" open="(" separator="," close=")">
                       #{state}
                   </foreach>
            UNION ALL
            SELECT c.id, c.course_no, c.course_name, c.owner_no, e.employee_name,
                   c.main_state, c.expect_publish_date,
                   '预计发布', c.expect_publish_date, NULL, NULL, NULL
              FROM biz_course c
              LEFT JOIN org_employee e ON e.employee_no = c.owner_no AND e.deleted = FALSE
             WHERE c.deleted = FALSE
               AND c.expect_publish_date BETWEEN #{from} AND #{to}
               AND c.main_state NOT IN
                   <foreach item="state" collection="terminalStates" open="(" separator="," close=")">
                       #{state}
                   </foreach>
             ORDER BY event_date, course_no
            </script>
            """)
    List<CourseCalendarItem> calendar(@Param("from") LocalDate from,
                                      @Param("to") LocalDate to,
                                      @Param("terminalStates") Collection<String> terminalStates);
}
