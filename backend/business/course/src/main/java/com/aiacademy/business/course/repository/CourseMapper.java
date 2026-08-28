package com.aiacademy.business.course.repository;

import com.aiacademy.business.course.domain.Course;
import com.aiacademy.business.course.domain.CourseListItem;
import com.aiacademy.business.course.domain.CourseQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

/**
 * 课程主表的读写。
 *
 * <p><b>不继承 {@code BaseMapper}。</b>{@code quality_marks} 是 JSONB 列，MyBatis-Plus 生成的
 * 通用 INSERT/UPDATE 会把 Java 侧的字符串按 {@code varchar} 绑定，PostgreSQL 不做隐式转换，
 * 只会报 {@code column is of type jsonb but expression is of type character varying}。手写 SQL
 * 加 {@code ::jsonb} 是最短的修法，代价是列名要写两遍——比引一个 JSONB TypeHandler 再让每个
 * 业务模块记得挂上去要可靠。
 *
 * <p><b>状态列不在任何写方法里。</b>五个状态列的唯一写入者是 {@code StateTransitionService}
 * （开发 5.1.4）。这里的 UPDATE 显式列出可编辑列，而不是 {@code SET} 整行，正是为了让
 * 「编辑课程顺手把状态也覆盖了」在语法上就不可能发生。
 */
@Mapper
public interface CourseMapper {

    String COLUMNS = """
            id, course_no, course_name, review_track, domain_code, owner_no,
            initiated_date, expect_publish_date, summary, target_audience, class_hours,
            category_code, source, remark, initiation_no, business_pain, course_goal, course_value,
            outline_summary, estimate_dev_days, review_judges, initiation_review_date,
            initiation_review_conclusion, initiation_review_opinion, initiation_status,
            plan_draft_date, actual_draft_date, enter_selfcheck,
            selfcheck_checker_no, selfcheck_completed_date, selfcheck_conclusion,
            selfcheck_record_status, submit_expert_review,
            selfcheck_spec_answers::text AS selfcheck_spec_answers,
            review_round_label, review_completed_date, review_ledger_phase, review_ledger_status,
            enter_trial, prelim_round_label, prelim_reviewers, prelim_review_date,
            prelim_completed_date, prelim_conclusion, prelim_opinion, enter_meeting,
            meeting_round_label, meeting_reviewers, meeting_actual_date,
            meeting_conclusion, meeting_opinion,
            trial_lecturer_no, trial_current_phase, trial_ledger_status, trial_round_label,
            trial_scheduled_date, trial_audience_group, trial_audience_count, trial_hours,
            trial_format, trial_satisfaction, trial_optimize_advice, trial_acceptance_result,
            trial_ready_to_publish, trial_lecturer_qualified, trial_conclusion_date, trial_remark,
            validity_period, validity_end_date, external_link,
            main_state, dev_state, selfcheck_state, trial_state, publish_state,
            first_publish_date, quality_marks, close_reason, current_material_version,
            created_at, created_by, updated_at, updated_by, last_state_changed_at, version, deleted
            """;

    /**
     * 取排他咨询锁，串行化课程编号的生成。
     *
     * <p>「查当前最大流水 + 1」在并发下会重号。共享账号意味着 2–4 名运营同时录入是常态而非偶发
     * （CLAUDE.md 第七节），靠唯一约束报错再重试，运营看到的是一次莫名其妙的失败。事务级咨询锁
     * 在提交时自动释放，单实例部署下没有额外成本。
     *
     * <p>返回值是 PostgreSQL 的 {@code void} 类型（一行一列的空值），声明成 {@code void} 会让
     * MyBatis 找不到结果映射的构造器。这里的返回值没有意义，调用方忽略即可。
     */
    @Select("SELECT pg_advisory_xact_lock(hashtext('biz_course.course_no'))")
    String lockCourseNoSequence();

    /**
     * 锁住一门课程的行，串行化「按已有条数 + 1」这类计算：材料版本号、评审轮次、试讲轮次。
     *
     * <p>共享账号下两名运营同时点同一个按钮是常态（CLAUDE.md 第七节），不锁就会算出两个 V2 或
     * 两个第 3 轮，最后撞在唯一约束上——运营看到的是一次没有解释的失败。
     *
     * @return 课程主键；null 表示课程不存在或已逻辑删除
     */
    @Select("SELECT id FROM biz_course WHERE id = #{courseId} AND deleted = FALSE FOR UPDATE")
    Long lockById(@Param("courseId") long courseId);

    /**
     * 生成下一个课程编号：KC + 年月 + 4 位流水（需求 9.3.1 第 1 项）。
     *
     * <p>不带 {@code deleted = FALSE}：编号是对外可见的业务标识，删掉的课程仍可能出现在导出的
     * 历史文件与线下沟通里，流水号一旦复用就对不上了。
     */
    @Select("""
            SELECT 'KC' || to_char(CURRENT_DATE, 'YYYYMM') || lpad((
                       COALESCE(MAX(substring(course_no from 9)::INT), 0) + 1)::TEXT, 4, '0')
              FROM biz_course
             WHERE course_no ~ ('^KC' || to_char(CURRENT_DATE, 'YYYYMM') || '\\d{4}$')
            """)
    String nextCourseNo();

    /**
     * 立项单号：LI + 年月 + 4 位流水。与课程编号同一把咨询锁里生成，避免并发重号。
     *
     * <p>历史回填用的是「年月 + 6 位 id」，对不上这条 4 位正则，不会把流水顶回去。
     */
    @Select("""
            SELECT 'LI' || to_char(CURRENT_DATE, 'YYYYMM') || lpad((
                       COALESCE(MAX(substring(initiation_no from 9)::INT), 0) + 1)::TEXT, 4, '0')
              FROM biz_course
             WHERE initiation_no ~ ('^LI' || to_char(CURRENT_DATE, 'YYYYMM') || '\\d{4}$')
            """)
    String nextInitiationNo();

    /**
     * 插入课程。
     *
     * <p>{@code main_state} 是 {@code NOT NULL}，所以初始状态在这里落库；随后由
     * {@code StateTransitionService.initialize} 补记「（空）→ 立项」的流转日志与
     * {@code last_state_changed_at}。两步都在同一事务内，不会出现有课程没日志的中间态。
     */
    @Select("""
            INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                    initiated_date, expect_publish_date, summary, target_audience,
                                    class_hours, category_code, source, remark, initiation_no,
                                    validity_period, external_link, quality_marks, main_state,
                                    created_by, updated_by)
            VALUES (#{c.courseNo}, #{c.courseName}, #{c.reviewTrack}, #{c.domainCode}, #{c.ownerNo},
                    #{c.initiatedDate}, #{c.expectPublishDate}, #{c.summary}, #{c.targetAudience},
                    #{c.classHours}, #{c.categoryCode}, #{c.source}, #{c.remark}, #{c.initiationNo},
                    #{c.validityPeriod}, #{c.externalLink}, #{c.qualityMarks}::jsonb, #{c.mainState},
                    #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("c") Course course, @Param("operator") String operator);

    /**
     * 编辑课程基本信息，带乐观锁（规则 K1）。
     *
     * <p>影响行数为 0 表示版本已变，由 Service 转成 {@code CONCURRENT_MODIFIED}。
     *
     * <p><b>不动 {@code last_state_changed_at}</b>：改一个错别字不该让红灯消失
     * （CLAUDE.md 第三节）。
     */
    @Update("""
            UPDATE biz_course
               SET course_name = #{c.courseName},
                   review_track = #{c.reviewTrack},
                   domain_code = #{c.domainCode},
                   owner_no = #{c.ownerNo},
                   initiated_date = #{c.initiatedDate},
                   expect_publish_date = #{c.expectPublishDate},
                   summary = #{c.summary},
                   target_audience = #{c.targetAudience},
                   class_hours = #{c.classHours},
                   category_code = #{c.categoryCode},
                   source = #{c.source},
                   remark = #{c.remark},
                   validity_period = #{c.validityPeriod},
                   validity_end_date = #{c.validityEndDate},
                   external_link = #{c.externalLink},
                   quality_marks = #{c.qualityMarks}::jsonb,
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{c.id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int update(@Param("c") Course course,
               @Param("operator") String operator,
               @Param("expectedVersion") int expectedVersion);

    /**
     * 只写立项页字段。不动评审轨道、有效期、预计发布——那些改了会牵动三色灯与试讲验收标准。
     *
     * <p>不动 {@code last_state_changed_at}。立项状态是字典项，不是状态机。
     */
    @Update("""
            UPDATE biz_course
               SET business_pain = #{c.businessPain},
                   course_goal = #{c.courseGoal},
                   course_value = #{c.courseValue},
                   target_audience = #{c.targetAudience},
                   outline_summary = #{c.outlineSummary},
                   estimate_dev_days = #{c.estimateDevDays},
                   review_judges = #{c.reviewJudges},
                   initiation_review_date = #{c.initiationReviewDate},
                   initiation_review_conclusion = #{c.initiationReviewConclusion},
                   initiation_review_opinion = #{c.initiationReviewOpinion},
                   initiation_status = #{c.initiationStatus},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{c.id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int updateInitiation(@Param("c") Course course,
                         @Param("operator") String operator,
                         @Param("expectedVersion") int expectedVersion);

    /**
     * 只写开发页台账字段。不动五个状态列与 {@code last_state_changed_at}。
     */
    @Update("""
            UPDATE biz_course
               SET owner_no = #{c.ownerNo},
                   plan_draft_date = #{c.planDraftDate},
                   actual_draft_date = #{c.actualDraftDate},
                   enter_selfcheck = #{c.enterSelfCheck},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{c.id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int updateDevelopment(@Param("c") Course course,
                          @Param("operator") String operator,
                          @Param("expectedVersion") int expectedVersion);

    /**
     * 只写自检页台账字段。不动五个状态列与 {@code last_state_changed_at}。
     */
    @Update("""
            UPDATE biz_course
               SET selfcheck_checker_no = #{c.selfcheckCheckerNo},
                   selfcheck_completed_date = #{c.selfcheckCompletedDate},
                   selfcheck_conclusion = #{c.selfcheckConclusion},
                   selfcheck_record_status = #{c.selfcheckRecordStatus},
                   submit_expert_review = #{c.submitExpertReview},
                   selfcheck_spec_answers = #{c.selfcheckSpecAnswers}::jsonb,
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{c.id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int updateSelfcheckInfo(@Param("c") Course course,
                            @Param("operator") String operator,
                            @Param("expectedVersion") int expectedVersion);

    /**
     * 只写评审页台账字段。不动五个状态列与 {@code last_state_changed_at}。
     */
    @Update("""
            UPDATE biz_course
               SET owner_no = #{c.ownerNo},
                   review_round_label = #{c.reviewRoundLabel},
                   review_completed_date = #{c.reviewCompletedDate},
                   review_ledger_phase = #{c.reviewLedgerPhase},
                   review_ledger_status = #{c.reviewLedgerStatus},
                   enter_trial = #{c.enterTrial},
                   prelim_round_label = #{c.prelimRoundLabel},
                   prelim_reviewers = #{c.prelimReviewers},
                   prelim_review_date = #{c.prelimReviewDate},
                   prelim_completed_date = #{c.prelimCompletedDate},
                   prelim_conclusion = #{c.prelimConclusion},
                   prelim_opinion = #{c.prelimOpinion},
                   enter_meeting = #{c.enterMeeting},
                   meeting_round_label = #{c.meetingRoundLabel},
                   meeting_reviewers = #{c.meetingReviewers},
                   meeting_actual_date = #{c.meetingActualDate},
                   meeting_conclusion = #{c.meetingConclusion},
                   meeting_opinion = #{c.meetingOpinion},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{c.id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int updateReviewLedger(@Param("c") Course course,
                           @Param("operator") String operator,
                           @Param("expectedVersion") int expectedVersion);

    /**
     * 只写试讲页台账字段。不动五个状态列与 {@code last_state_changed_at}。
     */
    @Update("""
            UPDATE biz_course
               SET owner_no = #{c.ownerNo},
                   trial_lecturer_no = #{c.trialLecturerNo},
                   trial_current_phase = #{c.trialCurrentPhase},
                   trial_ledger_status = #{c.trialLedgerStatus},
                   trial_round_label = #{c.trialRoundLabel},
                   trial_scheduled_date = #{c.trialScheduledDate},
                   trial_audience_group = #{c.trialAudienceGroup},
                   trial_audience_count = #{c.trialAudienceCount},
                   trial_hours = #{c.trialHours},
                   trial_format = #{c.trialFormat},
                   trial_satisfaction = #{c.trialSatisfaction},
                   trial_optimize_advice = #{c.trialOptimizeAdvice},
                   trial_acceptance_result = #{c.trialAcceptanceResult},
                   trial_ready_to_publish = #{c.trialReadyToPublish},
                   trial_lecturer_qualified = #{c.trialLecturerQualified},
                   trial_conclusion_date = #{c.trialConclusionDate},
                   trial_remark = #{c.trialRemark},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{c.id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int updateTrialLedger(@Param("c") Course course,
                          @Param("operator") String operator,
                          @Param("expectedVersion") int expectedVersion);

    /**
     * 首次进入「发布」时回填首次发布时间与有效期截止日（规则 EX1、EX3）。
     *
     * <p>{@code first_publish_date IS NULL} 是这条语句的全部要害：需求 EX2 规定
     * <b>首次发布时间只写一次</b>，课程回到「优化」再次发布也不重算——它是课程开发周期的终点，
     * 重算会让指标 15.2 变成「最后一次发布的耗时」。把这个判断放进 WHERE 而不是 Service 的
     * if，是因为并发下两次「录入试讲合格」都读到 NULL 时，只有一条能更新成功。
     */
    @Update("""
            UPDATE biz_course
               SET first_publish_date = #{publishDate},
                   validity_end_date = #{validityEndDate},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE AND first_publish_date IS NULL
            """)
    int markFirstPublished(@Param("id") long id,
                           @Param("publishDate") LocalDate publishDate,
                           @Param("validityEndDate") LocalDate validityEndDate,
                           @Param("operator") String operator);

    /** 关闭课程开发时随状态转换一起写关闭原因（需求 9.3.2 第 20 项：主状态为「已关闭」时必填）。 */
    @Update("""
            UPDATE biz_course
               SET close_reason = #{closeReason}, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateCloseReason(@Param("id") long id,
                          @Param("closeReason") String closeReason,
                          @Param("operator") String operator);

    /**
     * 快照产生新版本后回填「当前材料版本号」（需求 9.3.3 第 21 项）。
     *
     * <p>不动 {@code version} 乐观锁列：快照是系统动作，不是运营对课程基本信息的编辑，
     * 让它把别人正在编辑的表单顶掉说不过去。
     */
    @Update("""
            UPDATE biz_course
               SET current_material_version = #{versionNo}, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateCurrentMaterialVersion(@Param("id") long id,
                                     @Param("versionNo") String versionNo,
                                     @Param("operator") String operator);

    /** 逻辑删除（SEC2）。 */
    @Update("""
            UPDATE biz_course
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id, @Param("operator") String operator);

    @Select("SELECT " + COLUMNS + " FROM biz_course WHERE id = #{id} AND deleted = FALSE")
    Course selectById(@Param("id") long id);

    /** 详情页用，比 {@link #selectById} 多带负责人姓名、评审轮次、是否有关联需求三个派生列。 */
    @Select("""
            SELECT c.*,
                   c.selfcheck_spec_answers::text AS selfcheck_spec_answers,
                   e.employee_name AS owner_name,
                   (SELECT COUNT(*) FROM dtl_course_review r
                     WHERE r.course_id = c.id AND r.deleted = FALSE) AS review_round,
                   (SELECT r.record_state
                      FROM dtl_course_review r
                     WHERE r.course_id = c.id AND r.deleted = FALSE
                     ORDER BY r.round_no DESC
                     LIMIT 1) AS review_record_state,
                   EXISTS (SELECT 1 FROM rel_demand_course rc WHERE rc.course_id = c.id) AS has_demand
              FROM biz_course c
              LEFT JOIN org_employee e ON e.employee_no = c.owner_no AND e.deleted = FALSE
             WHERE c.id = #{id} AND c.deleted = FALSE
            """)
    CourseListItem selectDetailById(@Param("id") long id);

    /**
     * 课程列表（需求 9.10）。SQL 在 {@code mapper/CourseMapper.xml}——它与 {@link #countPage}
     * 必须共用同一段 WHERE，而 {@code <sql>} 片段是注解式 Mapper 给不了的。
     *
     * <p><b>为什么那条 SQL 直接查 {@code rel_demand_course}：</b>「是否有关联需求」是列表的筛选项
     * 之一，筛选条件必须与分页在同一条 SQL 里，拆到 app 层编排会让 {@code LIMIT/OFFSET} 失去意义。
     * AR-1 约束的是模块间的<b>类依赖</b>，跨模块的只读聚合查询走 SQL 在本项目已有先例
     * （{@code OwnedObjectMapper.countOwnedObjects} 一次查四张业务表）。关联关系的<b>写入</b>
     * 仍归需求模块。
     */
    List<CourseListItem> selectPage(@Param("q") CourseQuery query,
                                    @Param("offset") long offset,
                                    @Param("sortColumn") String sortColumn,
                                    @Param("sortDirection") String sortDirection);

    long countPage(@Param("q") CourseQuery query);
}
