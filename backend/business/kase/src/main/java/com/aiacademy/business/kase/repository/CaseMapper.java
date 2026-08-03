package com.aiacademy.business.kase.repository;

import com.aiacademy.business.kase.domain.CaseInfo;
import com.aiacademy.business.kase.domain.CaseListItem;
import com.aiacademy.business.kase.domain.CaseQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

/**
 * 案例主表的读写。
 *
 * <p><b>{@code case_state} 不在任何写方法里。</b>状态列的唯一写入者是 {@code StateTransitionService}
 * （开发 5.1.4）。这里的 UPDATE 显式列出可编辑列而不是 {@code SET} 整行，正是为了让「编辑案例
 * 顺手把状态也覆盖了」在语法上就不可能发生。
 *
 * <p>不继承 {@code BaseMapper}：这张表的写入路径要么带乐观锁、要么带「只写一次」的 WHERE 条件，
 * 通用 CRUD 反而要处处提防被误用。
 */
@Mapper
public interface CaseMapper {

    /**
     * 取排他咨询锁，串行化案例编号的生成。
     *
     * <p>「查当前最大流水 + 1」在并发下会重号。案例由课程转精品自动创建，两名运营同时标注两门
     * 课程达精品是完全可能的；靠唯一约束报错再重试，运营看到的是一次莫名其妙的失败。
     * 事务级咨询锁在提交时自动释放，单实例部署下没有额外成本。
     */
    @Select("SELECT pg_advisory_xact_lock(hashtext('biz_case.case_no'))")
    String lockCaseNoSequence();

    /**
     * 生成下一个案例编号：AL + 年月 + 3 位流水（需求 12.3 第 1 项）。
     *
     * <p>不带 {@code deleted = FALSE}：编号是对外可见的业务标识，删掉的案例仍可能出现在导出的
     * 历史文件里，流水号一旦复用就对不上了。
     *
     * <p>{@code lpad} 的宽度取 {@code GREATEST(3, LENGTH(...))}：流水超过 999 时固定宽度 3 会把
     * {@code 1000} 截成 {@code 000}，下一次生成又算出 1000，撞唯一约束——而这只在第 1000 个案例
     * 那天发生，测不出来。
     */
    @Select("""
            SELECT 'AL' || to_char(CURRENT_DATE, 'YYYYMM') || (
                       SELECT lpad(next_no::TEXT, GREATEST(3, LENGTH(next_no::TEXT)), '0')
                         FROM (SELECT COALESCE(MAX(substring(case_no from 9)::INT), 0) + 1 AS next_no
                                 FROM biz_case
                                WHERE case_no ~ ('^AL' || to_char(CURRENT_DATE, 'YYYYMM') || '\\d+$')
                              ) s)
            """)
    String nextCaseNo();

    /**
     * 建案例。只有一条路径会调它：课程标注达精品时的 {@code CREATE_CASE} 副作用（议题 27）。
     *
     * <p>{@code case_state} 是 {@code NOT NULL}，初始状态在这里落库；随后由
     * {@code TransitionApplicationService.initialize} 补记「（空）→ 待整理」的流转日志与
     * {@code last_state_changed_at}。两步同事务，不会出现有案例没日志的中间态。
     */
    @Select("""
            INSERT INTO biz_case (case_no, case_name, course_id, contributing_org, contributors,
                                  domain_codes, owner_no, case_state, expect_publish_date,
                                  created_by, updated_by)
            VALUES (#{c.caseNo}, #{c.caseName}, #{c.courseId}, #{c.contributingOrg},
                    #{c.contributors}::jsonb, #{c.domainCodes}::jsonb, #{c.ownerNo}, #{c.caseState},
                    #{c.expectPublishDate}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("c") CaseInfo caseInfo, @Param("operator") String operator);

    /**
     * 编辑案例基本信息，带乐观锁（规则 K1）。影响行数为 0 表示版本已变。
     *
     * <p><b>不动 {@code last_state_changed_at}</b>：改一个错别字不该让红灯消失（规则 C6）。
     */
    @Update("""
            UPDATE biz_case
               SET case_name = #{c.caseName},
                   contributing_org = #{c.contributingOrg},
                   contributors = #{c.contributors}::jsonb,
                   domain_codes = #{c.domainCodes}::jsonb,
                   owner_no = #{c.ownerNo},
                   quality_marks = #{c.qualityMarks}::jsonb,
                   content = #{c.content},
                   expect_publish_date = #{c.expectPublishDate},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{c.id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int update(@Param("c") CaseInfo caseInfo,
               @Param("operator") String operator,
               @Param("expectedVersion") int expectedVersion);

    /**
     * 录入审核结论时写审核四字段（需求 12.3 第 9a～9d 项）。
     *
     * <p><b>直接覆盖，不建历史表</b>：需求 12.3 第 9d 项明确「后一次审核覆盖前一次，不记轮次」
     * （C09 第 4 条）。这与需求的业务验收刚好相反，不要把两者做成一样。
     *
     * <p>带乐观锁：结论决定案例是上架还是退回整理，两名运营同时录入相反的结论时必须有一个失败
     * ——否则会出现「主表写着不通过、状态却是已上架」的案例。
     */
    @Update("""
            UPDATE biz_case
               SET reviewer_no = #{reviewerNo},
                   reviewed_at = #{reviewedAt},
                   review_opinion = #{reviewOpinion},
                   review_result = #{reviewResult},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int recordAudit(@Param("id") long id,
                    @Param("reviewerNo") String reviewerNo,
                    @Param("reviewedAt") LocalDate reviewedAt,
                    @Param("reviewOpinion") String reviewOpinion,
                    @Param("reviewResult") String reviewResult,
                    @Param("operator") String operator,
                    @Param("expectedVersion") int expectedVersion);

    /**
     * 审核通过时写上架时间（需求 12.3 第 15 项）。
     *
     * <p>{@code COALESCE} 是这条语句的要害：案例可以「下架修改 → 再审核通过」反复上架，而
     * <b>上架时间只写一次</b>——它是案例上架周期（15.5）的终点，重算会让指标变成「最后一次
     * 上架用了多久」。用 COALESCE 而不是 Service 里的 if，是因为并发下两次都读到 NULL 时，
     * SQL 侧的写法仍然只有一个值能留下。
     */
    @Update("""
            UPDATE biz_case
               SET published_at = COALESCE(published_at, NOW()),
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int markPublished(@Param("id") long id, @Param("operator") String operator);

    /** 逻辑删除（SEC2）。 */
    @Update("""
            UPDATE biz_case
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id, @Param("operator") String operator);

    @Select("SELECT * FROM biz_case WHERE id = #{id} AND deleted = FALSE")
    CaseInfo selectById(@Param("id") long id);

    /** 一门课程至多一个案例（{@code uk_case_course}）。{@code CREATE_CASE} 用它做幂等判断。 */
    @Select("SELECT id FROM biz_case WHERE course_id = #{courseId} AND deleted = FALSE")
    Long selectIdByCourse(@Param("courseId") long courseId);

    /** 详情页用，比 {@link #selectById} 多带三个姓名列与四项互动计数。SQL 在 XML 里与列表共用片段。 */
    CaseListItem selectDetailById(@Param("id") long id);

    /**
     * 案例列表／看板卡片流（需求 12.7）。SQL 在 {@code mapper/CaseMapper.xml}——它与
     * {@link #countPage} 必须共用同一段 WHERE，而 {@code <sql>} 片段是注解式 Mapper 给不了的。
     */
    List<CaseListItem> selectPage(@Param("q") CaseQuery query,
                                  @Param("offset") long offset,
                                  @Param("sortExpression") String sortExpression);

    long countPage(@Param("q") CaseQuery query);
}
