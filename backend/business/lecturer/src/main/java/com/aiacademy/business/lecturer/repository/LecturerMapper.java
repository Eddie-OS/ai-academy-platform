package com.aiacademy.business.lecturer.repository;

import com.aiacademy.business.lecturer.domain.Lecturer;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;

/**
 * 讲师主表的读写。
 *
 * <p><b>不继承 {@code BaseMapper}</b>，理由同 {@code CourseMapper}：{@code expertise_domains} 是
 * JSONB 列，MyBatis-Plus 的通用 INSERT/UPDATE 会按 {@code varchar} 绑定，PostgreSQL 不做隐式转换。
 *
 * <p><b>列表查询不在这里。</b>需求 10.7 要求默认按累计授课次数排序、支持平均评分区间筛选，
 * 而这两项要读培训场次、签到与学员反馈——那是培训模块的表。业务模块之间不得互相依赖（AR-1），
 * 哪怕依赖只藏在 SQL 文本里 ArchUnit 看不见。列表查询因此落在 app 层的 {@code LecturerBoardMapper}。
 */
@Mapper
public interface LecturerMapper {

    String COLUMNS = """
            id, lecturer_no, lecturer_name, employee_no, source_dept, expertise_domains,
            teaching_direction, join_type, joined_date, training_state, trial_qualified,
            first_qualified_date, pool_state, removed_reason, import_batch_no,
            created_at, created_by, updated_at, updated_by
            """;

    /**
     * 取排他咨询锁，串行化讲师编号的生成。理由同培训计划编号：「查最大流水 + 1」在并发下会重号，
     * 而共享账号让并发录入成为常态。
     */
    @Select("SELECT pg_advisory_xact_lock(hashtext('biz_lecturer.lecturer_no'))")
    String lockLecturerNoSequence();

    /**
     * 下一个讲师ID：JS + 4 位流水（需求 10.3 第 1 项）。
     *
     * <p>不带 {@code deleted = FALSE}：编号一旦用过就不复用，否则「JS0007」会先后指向两个人。
     * {@code WHERE} 里的格式过滤不是多余的——库里只要有一个不符合 JS+数字 的讲师ID，
     * {@code ::int} 就会直接报错，新增讲师整个功能不可用。
     *
     * <p>{@code GREATEST(4, LENGTH(...))} 是为了躲开 {@code lpad} 的截断语义：
     * PostgreSQL 的 {@code lpad(s, n)} 在 {@code s} 比 {@code n} 长时<b>从右侧截掉</b>，
     * 而不是原样返回。写死 4 的话第 10000 位讲师会拿到 {@code JS1000}，
     * 与第 1000 位撞唯一约束——症状是「新增讲师突然失败」，离原因很远。
     */
    @Select("""
            SELECT 'JS' || lpad(next_no, GREATEST(4, LENGTH(next_no)), '0')
              FROM (SELECT (COALESCE(MAX(SUBSTRING(lecturer_no FROM 3)::INT), 0) + 1)::TEXT AS next_no
                      FROM biz_lecturer
                     WHERE lecturer_no ~ '^JS[0-9]+$') t
            """)
    String nextLecturerNo();

    @Select("""
            INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                                      expertise_domains, teaching_direction, join_type, joined_date,
                                      training_state, trial_qualified, pool_state, removed_reason,
                                      created_by, updated_by)
            VALUES (#{l.lecturerNo}, #{l.lecturerName}, #{l.employeeNo}, #{l.sourceDept},
                    #{l.expertiseDomains}::jsonb, #{l.teachingDirection}, #{l.joinType}, #{l.joinedDate},
                    #{l.trainingState}, FALSE, #{l.poolState}, #{l.removedReason},
                    #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("l") Lecturer lecturer, @Param("operator") String operator);

    /**
     * 编辑讲师。
     *
     * <p><b>不更新入池方式、入池时间、试讲合格标记、首次试讲合格时间。</b>前两个是「首次入池」的
     * 事实，后两个只能由试讲结论录入产生。它们不在表单里，这里也就不该出现——列写死在 SQL 里，
     * 让「编辑顺手改掉了试讲合格标记」在语法上就不可能发生。
     */
    @Update("""
            UPDATE biz_lecturer
               SET lecturer_name = #{l.lecturerName},
                   employee_no = #{l.employeeNo},
                   source_dept = #{l.sourceDept},
                   expertise_domains = #{l.expertiseDomains}::jsonb,
                   teaching_direction = #{l.teachingDirection},
                   training_state = #{l.trainingState},
                   pool_state = #{l.poolState},
                   removed_reason = #{l.removedReason},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{l.id} AND deleted = FALSE
            """)
    int update(@Param("l") Lecturer lecturer, @Param("operator") String operator);

    /**
     * 试讲讲师结论 = 合格时置标记（需求 10.3 第 9、10 项，副作用
     * {@code UPDATE_LECTURER_TRIAL_FLAG}）。
     *
     * <p>{@code COALESCE} 保证首次试讲合格时间只写一次：讲师可以反复试讲，而这一项是
     * 「首次到达」型事实，重写会让它变成「最后一次合格是什么时候」。
     *
     * <p><b>不动培养状态</b>（规则 TS5）：合格了也不自动改成「可上岗」，是否可上岗由运营判断。
     */
    @Update("""
            UPDATE biz_lecturer
               SET trial_qualified = TRUE,
                   first_qualified_date = COALESCE(first_qualified_date, #{qualifiedDate}),
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int markTrialQualified(@Param("id") long id,
                           @Param("qualifiedDate") LocalDate qualifiedDate,
                           @Param("operator") String operator);

    /**
     * 逻辑删除（SEC2）。
     *
     * <p><b>这不是「移出讲师池」。</b>移出是把 {@code pool_state} 改成「已移出」并填移出原因，
     * 讲师仍在列表里可查（需求 10.3 第 14 项）；逻辑删除是录错了人要撤掉这条记录。
     */
    @Update("""
            UPDATE biz_lecturer
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id, @Param("operator") String operator);

    @Select("SELECT " + COLUMNS + " FROM biz_lecturer WHERE id = #{id} AND deleted = FALSE")
    Lecturer selectById(@Param("id") long id);

    /**
     * 工号唯一（需求 10.3 第 3 项）。编辑时要排除自己，否则原样保存会撞上自己。
     *
     * <p>{@code jdbcType=BIGINT} 不能省：{@code excludeId} 为空时 MyBatis 按 {@code OTHER} 绑定，
     * PostgreSQL 推断不出 {@code $1 IS NULL} 里 {@code $1} 的类型，新增讲师会直接报驱动层的错。
     */
    @Select("""
            SELECT COUNT(1) FROM biz_lecturer
             WHERE employee_no = #{employeeNo} AND deleted = FALSE
               AND (#{excludeId,jdbcType=BIGINT} IS NULL OR id <> #{excludeId,jdbcType=BIGINT})
            """)
    boolean existsByEmployeeNo(@Param("employeeNo") String employeeNo,
                               @Param("excludeId") Long excludeId);

    /** 课程负责人自动入池前的查重（需求 10.4 第 1 行「若讲师池中无其工号记录」）。 */
    @Select("SELECT id FROM biz_lecturer WHERE employee_no = #{employeeNo} AND deleted = FALSE")
    Long selectIdByEmployeeNo(@Param("employeeNo") String employeeNo);
}
