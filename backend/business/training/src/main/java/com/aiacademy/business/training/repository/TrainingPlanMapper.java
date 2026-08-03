package com.aiacademy.business.training.repository;

import com.aiacademy.business.training.domain.TrainingPlan;
import com.aiacademy.business.training.domain.TrainingPlanListItem;
import com.aiacademy.business.training.domain.TrainingPlanQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

/**
 * 培训计划主表的读写。
 *
 * <p><b>{@code plan_state} 不在任何写方法里</b>（INSERT 的初始值除外）：状态列的唯一写入者是
 * {@code StateTransitionService}（开发 5.1.4）。UPDATE 显式列出可编辑列而不是整行覆盖，
 * 让「编辑计划顺手把状态也改了」在语法上就不可能发生。
 */
@Mapper
public interface TrainingPlanMapper {

    String COLUMNS = """
            id, plan_no, plan_name, course_id, owner_no, target_scope,
            plan_start_date, plan_end_date, plan_session_count,
            plan_state, actual_finish_date, remark,
            created_at, created_by, updated_at, updated_by, last_state_changed_at, deleted
            """;

    /**
     * 取排他咨询锁，串行化计划编号的生成。理由同需求编号：「查最大流水 + 1」在并发下会重号，
     * 而共享账号让并发录入成为常态；靠唯一约束报错再重试，运营看到的是一次无从解释的失败。
     */
    @Select("SELECT pg_advisory_xact_lock(hashtext('biz_training_plan.plan_no'))")
    String lockPlanNoSequence();

    /**
     * 生成下一个计划编号：JH + 年月 + 3 位流水（需求 11.3 第 1 项）。
     *
     * <p>不带 {@code deleted = FALSE}：编号是对外可见的业务标识，删掉的计划仍可能出现在导出的
     * 历史文件与线下沟通里，流水号一旦复用就对不上了。<b>场次号以计划号为前缀</b>，重号的后果
     * 会顺着场次号扩散到签到导入模板的关联键上。
     */
    @Select("""
            SELECT 'JH' || to_char(CURRENT_DATE, 'YYYYMM') || lpad((
                       COALESCE(MAX(substring(plan_no from 9)::INT), 0) + 1)::TEXT, 3, '0')
              FROM biz_training_plan
             WHERE plan_no ~ ('^JH' || to_char(CURRENT_DATE, 'YYYYMM') || '\\d{3}$')
            """)
    String nextPlanNo();

    /**
     * 插入计划。
     *
     * <p>{@code plan_state} 是 {@code NOT NULL}，所以初始状态在这里落库；随后由
     * {@code TransitionApplicationService.initialize} 补记「（空）→ 待执行」的流转日志与
     * {@code last_state_changed_at}。两步同事务，不会出现有计划没日志的中间态。
     */
    @Select("""
            INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                                           plan_start_date, plan_end_date, plan_session_count,
                                           plan_state, remark, created_by, updated_by)
            VALUES (#{p.planNo}, #{p.planName}, #{p.courseId}, #{p.ownerNo}, #{p.targetScope},
                    #{p.planStartDate}, #{p.planEndDate}, #{p.planSessionCount},
                    #{p.planState}, #{p.remark}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("p") TrainingPlan plan, @Param("operator") String operator);

    /**
     * 编辑计划基本信息。
     *
     * <p><b>不动 {@code last_state_changed_at}</b>：改一个错别字不该让红灯消失（规则 C6）。
     *
     * <p>没有乐观锁参数——培训计划不在需求/课程/案例三张带 {@code version} 的表里（规则 K1）。
     */
    @Update("""
            UPDATE biz_training_plan
               SET plan_name = #{p.planName},
                   course_id = #{p.courseId},
                   owner_no = #{p.ownerNo},
                   target_scope = #{p.targetScope},
                   plan_start_date = #{p.planStartDate},
                   plan_end_date = #{p.planEndDate},
                   plan_session_count = #{p.planSessionCount},
                   remark = #{p.remark},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{p.id} AND deleted = FALSE
            """)
    int update(@Param("p") TrainingPlan plan, @Param("operator") String operator);

    /**
     * 计划首次进入「已完成」时写实际完成时间（需求 11.3 第 12 项）。
     *
     * <p>{@code COALESCE} 是这条语句的要害：计划可以从「已完成」退回「执行中」再次完成，
     * 转换表明确写着「实际完成时间保留不清空」。重写会让 15.2.1 第 9 项的按时完成率把一个
     * 按时完成过的计划算成逾期。
     */
    @Update("""
            UPDATE biz_training_plan
               SET actual_finish_date = COALESCE(actual_finish_date, #{finishedAt}),
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int markFinished(@Param("id") long id,
                     @Param("finishedAt") LocalDate finishedAt,
                     @Param("operator") String operator);

    /** 逻辑删除（SEC2）。 */
    @Update("""
            UPDATE biz_training_plan
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id, @Param("operator") String operator);

    /** 计划下还有几个未删除的场次。删除计划前要看它——场次是挂在计划下的，孤儿场次查不到入口。 */
    @Select("""
            SELECT COUNT(*) FROM biz_training_session
             WHERE plan_id = #{planId} AND deleted = FALSE
            """)
    int countSessions(@Param("planId") long planId);

    @Select("SELECT " + COLUMNS + " FROM biz_training_plan WHERE id = #{id} AND deleted = FALSE")
    TrainingPlan selectById(@Param("id") long id);

    /**
     * 详情页用，比 {@link #selectById} 多带负责人姓名与实际场次数两个派生列。
     *
     * <p><b>课程名称不在这条 SQL 里。</b>{@code biz_course} 属于课程模块，培训模块直接 JOIN 它
     * 就等于绕开 AR-1 建立了模块间依赖——只不过依赖藏在 SQL 文本里，ArchUnit 看不见。课程名称
     * 由 app 层批量补齐（同 {@code DemandCourseLinkMapper} 放在 app 模块的理由）。
     */
    @Select("""
            SELECT p.*,
                   owner.employee_name AS owner_name,
                   (SELECT COUNT(*) FROM biz_training_session s
                     WHERE s.plan_id = p.id AND s.deleted = FALSE) AS actual_session_count
              FROM biz_training_plan p
              LEFT JOIN org_employee owner ON owner.employee_no = p.owner_no AND owner.deleted = FALSE
             WHERE p.id = #{id} AND p.deleted = FALSE
            """)
    TrainingPlanListItem selectDetailById(@Param("id") long id);

    /**
     * 计划列表（需求 11.8 P4-2）。SQL 在 {@code mapper/TrainingPlanMapper.xml}——它与
     * {@link #countPage} 必须共用同一段 WHERE，而 {@code <sql>} 片段是注解式 Mapper 给不了的。
     */
    List<TrainingPlanListItem> selectPage(@Param("q") TrainingPlanQuery query,
                                          @Param("offset") long offset,
                                          @Param("sortColumn") String sortColumn,
                                          @Param("sortDirection") String sortDirection);

    long countPage(@Param("q") TrainingPlanQuery query);
}
