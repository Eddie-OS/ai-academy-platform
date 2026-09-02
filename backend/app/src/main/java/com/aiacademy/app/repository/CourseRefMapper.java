package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/**
 * 培训侧读课程的最小视图。
 *
 * <p><b>放在 app 模块而不是培训模块</b>：{@code biz_course} 是课程模块的表，培训模块直接 JOIN 它
 * 会绕开 AR-1 建立一条 ArchUnit 看不见的模块间依赖（同 {@code DemandCourseLinkMapper} 的理由）。
 *
 * <p>批量而非逐行：一页 20 行计划就是 20 次查询，而这里一次就够。
 */
@Mapper
public interface CourseRefMapper {

    /**
     * @param mainState       课程主状态。排课校验二要它（需求 11.4.1 校验二）
     * @param validityEndDate 有效期截止日。已过期的课程仍可排课，但要给非阻断提示（规则 EX6）
     */
    record CourseRef(long id, String courseNo, String courseName, String outlineSummary,
                     String mainState, LocalDate validityEndDate) {
    }

    @Select("""
            <script>
            SELECT id, course_no, course_name, outline_summary, main_state, validity_end_date
              FROM biz_course
             WHERE deleted = FALSE AND id IN
             <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
            </script>
            """)
    List<CourseRef> findByIds(@Param("ids") Collection<Long> ids);

    @Select("""
            SELECT id, course_no, course_name, outline_summary, main_state, validity_end_date
              FROM biz_course
             WHERE deleted = FALSE AND id = #{id}
            """)
    CourseRef findById(@Param("id") long id);

    /**
     * 排课时的课程候选（需求 11.4.1 校验二）。
     *
     * <p>主状态集合由调用方给（{@code CourseStateMachines.MAIN_STATES_SCHEDULABLE}），不写死在
     * SQL 里——状态值只应出现在状态机模块（出口准则 E2-6）。
     *
     * <p>只回前 50 条：课程是数百量级，排课时运营是按课名搜的，长列表帮不上忙。
     */
    @Select("""
            <script>
            SELECT id, course_no, course_name, outline_summary, main_state, validity_end_date
              FROM biz_course
             WHERE deleted = FALSE
               AND main_state IN
               <foreach collection="mainStates" item="state" open="(" separator="," close=")">#{state}</foreach>
            <if test="keyword != null">
               AND (course_name ILIKE #{keyword} ESCAPE '\\' OR course_no ILIKE #{keyword} ESCAPE '\\')
            </if>
             ORDER BY course_name
             LIMIT 50
            </script>
            """)
    List<CourseRef> findSchedulable(@Param("mainStates") Collection<String> mainStates,
                                    @Param("keyword") String keyword);
}
