package com.aiacademy.business.demand.repository;

import com.aiacademy.business.demand.domain.Demand;
import com.aiacademy.business.demand.domain.DemandListItem;
import com.aiacademy.business.demand.domain.DemandQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

/**
 * 需求主表的读写。
 *
 * <p><b>状态列不在任何写方法里。</b>五个状态列（评审 / 解决方案 / 开发 / 业务验收 / 交付标记）
 * 的唯一写入者是 {@code StateTransitionService}（开发 5.1.4）。这里的 UPDATE 显式列出可编辑列，
 * 而不是 {@code SET} 整行，正是为了让「编辑需求顺手把状态也覆盖了」在语法上就不可能发生。
 *
 * <p>不继承 {@code BaseMapper}：这张表的写入路径都要么带乐观锁、要么带「只写一次」的 WHERE
 * 条件，通用 CRUD 反而要处处提防被误用。
 */
@Mapper
public interface DemandMapper {

    String COLUMNS = """
            id, demand_no, demand_name, domain_code, proposer_no, proposer_dept, owner_no,
            proposed_date, expect_finish_date, description, demand_source, demand_type, priority,
            review_state, review_date, review_conclusion, review_opinion,
            outlet, solution_state, solution_name, dev_state,
            first_online_date, latest_online_date, optimize_count,
            delivery_mark, delivered_at, archived_at,
            acceptance_state, acceptor_name, accepted_at, acceptance_opinion, acceptance_round,
            created_at, created_by, updated_at, updated_by, last_state_changed_at, version, deleted
            """;

    /**
     * 取排他咨询锁，串行化需求编号的生成。
     *
     * <p>「查当前最大流水 + 1」在并发下会重号。共享账号意味着 2–4 名运营同时录入是常态而非偶发
     * （CLAUDE.md 第七节），靠唯一约束报错再重试，运营看到的是一次莫名其妙的失败。事务级咨询锁
     * 在提交时自动释放，单实例部署下没有额外成本。
     */
    @Select("SELECT pg_advisory_xact_lock(hashtext('biz_demand.demand_no'))")
    String lockDemandNoSequence();

    /**
     * 锁住一条需求的行，串行化「按已有条数 + 1」这类计算：评审轮次、验收轮次。
     *
     * <p>共享账号下两名运营同时点同一个按钮是常态（CLAUDE.md 第七节），不锁就会算出两个第 2 轮，
     * 最后撞在唯一约束上——运营看到的是一次没有解释的失败。
     *
     * @return 需求主键；null 表示需求不存在或已逻辑删除
     */
    @Select("SELECT id FROM biz_demand WHERE id = #{demandId} AND deleted = FALSE FOR UPDATE")
    Long lockById(@Param("demandId") long demandId);

    /**
     * 生成下一个需求编号：XQ + 年月 + 4 位流水（需求 8.3.1 第 1 项）。
     *
     * <p>不带 {@code deleted = FALSE}：编号是对外可见的业务标识，删掉的需求仍可能出现在导出的
     * 历史文件与线下沟通里，流水号一旦复用就对不上了。
     */
    @Select("""
            SELECT 'XQ' || to_char(CURRENT_DATE, 'YYYYMM') || lpad((
                       COALESCE(MAX(substring(demand_no from 9)::INT), 0) + 1)::TEXT, 4, '0')
              FROM biz_demand
             WHERE demand_no ~ ('^XQ' || to_char(CURRENT_DATE, 'YYYYMM') || '\\d{4}$')
            """)
    String nextDemandNo();

    /**
     * 插入需求。
     *
     * <p>{@code review_state} 是 {@code NOT NULL}，所以初始状态在这里落库；随后由
     * {@code StateTransitionService.initialize} 补记「（空）→ 待评审」的流转日志与
     * {@code last_state_changed_at}。两步都在同一事务内，不会出现有需求没日志的中间态。
     */
    @Select("""
            INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, proposer_dept,
                                    owner_no, proposed_date, expect_finish_date, description,
                                    demand_source, demand_type, priority, review_state,
                                    created_by, updated_by)
            VALUES (#{d.demandNo}, #{d.demandName}, #{d.domainCode}, #{d.proposerNo}, #{d.proposerDept},
                    #{d.ownerNo}, #{d.proposedDate}, #{d.expectFinishDate}, #{d.description},
                    #{d.demandSource}, #{d.demandType}, #{d.priority}, #{d.reviewState},
                    #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("d") Demand demand, @Param("operator") String operator);

    /**
     * 编辑需求基本信息，带乐观锁（规则 K1）。
     *
     * <p>影响行数为 0 表示版本已变，由 Service 转成 {@code CONCURRENT_MODIFIED}。
     *
     * <p><b>不动 {@code last_state_changed_at}</b>：改一个错别字不该让红灯消失（规则 C6）。
     */
    @Update("""
            UPDATE biz_demand
               SET demand_name = #{d.demandName},
                   domain_code = #{d.domainCode},
                   proposer_no = #{d.proposerNo},
                   proposer_dept = #{d.proposerDept},
                   owner_no = #{d.ownerNo},
                   proposed_date = #{d.proposedDate},
                   expect_finish_date = #{d.expectFinishDate},
                   description = #{d.description},
                   demand_source = #{d.demandSource},
                   demand_type = #{d.demandType},
                   priority = #{d.priority},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{d.id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int update(@Param("d") Demand demand,
               @Param("operator") String operator,
               @Param("expectedVersion") int expectedVersion);

    /**
     * 录入评审结论时回写主表上的「当前一轮」评审字段与分流出口（需求 8.3.2、8.3.3 第 19 项）。
     *
     * <p>带乐观锁：出口决定后续激活哪一组状态字段，两名运营同时录入不同结论时必须有一个失败，
     * 否则会出现「评审结论说走出口一、出口列写着出口二」的记录。
     */
    @Update("""
            UPDATE biz_demand
               SET review_date = #{reviewDate},
                   review_conclusion = #{reviewConclusion},
                   review_opinion = #{reviewOpinion},
                   outlet = #{outlet},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int recordReviewConclusion(@Param("id") long id,
                               @Param("reviewDate") LocalDate reviewDate,
                               @Param("reviewConclusion") String reviewConclusion,
                               @Param("reviewOpinion") String reviewOpinion,
                               @Param("outlet") String outlet,
                               @Param("operator") String operator,
                               @Param("expectedVersion") int expectedVersion);

    /**
     * 重新评审时清空分流出口（需求 5.2.1 第 5 条）。
     *
     * <p><b>只清出口，不清解决方案状态与需求开发状态。</b>那两列是状态列，唯一写入者是状态机
     * 引擎（开发 5.1.4）；在这里顺手清掉会产生一次没有流转日志的状态变更，需求 15.2 的效率指标
     * 从此对不上。重新选定出口后，原来那一组状态仍在，运营按转换表继续推进即可。
     */
    @Update("""
            UPDATE biz_demand
               SET outlet = NULL, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int clearOutlet(@Param("id") long id, @Param("operator") String operator);

    /** 「输出解决方案」时录入解决方案名称（需求 8.3.3 第 22 项，出口一时必填）。 */
    @Update("""
            UPDATE biz_demand
               SET solution_name = #{solutionName}, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateSolutionName(@Param("id") long id,
                           @Param("solutionName") String solutionName,
                           @Param("operator") String operator);

    /**
     * 进入「已上线」时写上线时间（需求 8.3.3 第 25／26 项）。
     *
     * <p>{@code first_online_date = COALESCE(first_online_date, ?)} 是这条语句的要害：需求可以从
     * 「已上线」反复回到「优化中」，每次优化上线都会再次执行本语句，而<b>首次上线时间只写一次</b>
     * ——它是需求处理周期（15.2）的终点，重算会让指标变成「最后一次上线用了多久」。用 COALESCE
     * 而不是 Service 里的 if，是因为并发下两次「上线」都读到 NULL 时，SQL 侧的写法仍然只有
     * 一个值能留下。
     */
    @Update("""
            UPDATE biz_demand
               SET first_online_date = COALESCE(first_online_date, #{onlineDate}),
                   latest_online_date = #{onlineDate},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int markOnline(@Param("id") long id,
                   @Param("onlineDate") LocalDate onlineDate,
                   @Param("operator") String operator);

    /** 进入「优化中」时优化次数 +1（需求 8.3.3 第 27 项）。不设上限（议题 2）。 */
    @Update("""
            UPDATE biz_demand
               SET optimize_count = optimize_count + 1, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int incrementOptimizeCount(@Param("id") long id, @Param("operator") String operator);

    /**
     * 标记交付使用时写交付时间（需求 5.2.5 第 1 行、8.3.4 第 29 项）。
     *
     * <p>{@code COALESCE} 的理由与 {@link #markOnline} 不同：这一次点击要推进<b>两个</b>状态机
     * （业务验收状态与需求交付标记），两条转换都带 {@code SET_DELIVERED_AT}，本语句因此会被执行
     * 两次。交付时间是需求处理周期的一个时点，两次写成不同的值（跨零点时真的会不同）比写错更难查。
     */
    @Update("""
            UPDATE biz_demand
               SET delivered_at = COALESCE(delivered_at, #{deliveredAt}),
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int markDelivered(@Param("id") long id,
                      @Param("deliveredAt") LocalDate deliveredAt,
                      @Param("operator") String operator);

    /**
     * 录入验收结论时回写主表上的「最新一轮」验收字段（需求 5.2.5 第 2、3 行）。
     *
     * <p>带乐观锁：结论决定后续是能归档还是要退回返工，两名运营同时录入相反的结论时必须有一个
     * 失败——否则会出现「主表写着验收通过、验收记录里最后一条是不通过」的需求。
     *
     * <p><b>不写 {@code acceptance_state}</b>：那是状态列，唯一写入者是状态机引擎（开发 5.1.4）。
     */
    @Update("""
            UPDATE biz_demand
               SET acceptor_name = #{acceptorName},
                   accepted_at = #{acceptedAt},
                   acceptance_opinion = #{acceptanceOpinion},
                   updated_at = NOW(),
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int recordAcceptance(@Param("id") long id,
                         @Param("acceptorName") String acceptorName,
                         @Param("acceptedAt") LocalDate acceptedAt,
                         @Param("acceptanceOpinion") String acceptanceOpinion,
                         @Param("operator") String operator,
                         @Param("expectedVersion") int expectedVersion);

    /**
     * 重新提交验收时轮次 +1（需求 8.3.4 第 34 项）。不设上限（5.2.5 第 4 行）。
     *
     * <p>数的是<b>重新提交的次数</b>：首轮验收时它是 0，验收记录表里的轮次却是 1。两者差 1 是
     * 有意的——列上写「验收了几次」的话，交付后还没验收的需求就该是 0 还是 1 说不清楚。
     */
    @Update("""
            UPDATE biz_demand
               SET acceptance_round = acceptance_round + 1, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int incrementAcceptanceRound(@Param("id") long id, @Param("operator") String operator);

    /** 归档时写归档时间（需求 5.2.5 前置与终态第 2 行、8.3.4 第 36 项）。 */
    @Update("""
            UPDATE biz_demand
               SET archived_at = #{archivedAt}, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int markArchived(@Param("id") long id,
                     @Param("archivedAt") LocalDate archivedAt,
                     @Param("operator") String operator);

    /** 逻辑删除（SEC2）。 */
    @Update("""
            UPDATE biz_demand
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id, @Param("operator") String operator);

    @Select("SELECT " + COLUMNS + " FROM biz_demand WHERE id = #{id} AND deleted = FALSE")
    Demand selectById(@Param("id") long id);

    /** 详情页用，比 {@link #selectById} 多带负责人姓名、提出人姓名、关联课程数三个派生列。 */
    @Select("""
            SELECT d.*,
                   owner.employee_name AS owner_name,
                   proposer.employee_name AS proposer_name,
                   (SELECT COUNT(*) FROM rel_demand_course rc WHERE rc.demand_id = d.id) AS course_count
              FROM biz_demand d
              LEFT JOIN org_employee owner ON owner.employee_no = d.owner_no AND owner.deleted = FALSE
              LEFT JOIN org_employee proposer ON proposer.employee_no = d.proposer_no
                                             AND proposer.deleted = FALSE
             WHERE d.id = #{id} AND d.deleted = FALSE
            """)
    DemandListItem selectDetailById(@Param("id") long id);

    /**
     * 需求列表（需求 8.6）。SQL 在 {@code mapper/DemandMapper.xml}——它与 {@link #countPage}
     * 必须共用同一段 WHERE，而 {@code <sql>} 片段是注解式 Mapper 给不了的。
     */
    List<DemandListItem> selectPage(@Param("q") DemandQuery query,
                                    @Param("offset") long offset,
                                    @Param("sortColumn") String sortColumn,
                                    @Param("sortDirection") String sortDirection);

    long countPage(@Param("q") DemandQuery query);
}
