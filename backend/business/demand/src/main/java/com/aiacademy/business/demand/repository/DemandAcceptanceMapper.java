package com.aiacademy.business.demand.repository;

import com.aiacademy.business.demand.domain.DemandAcceptance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/**
 * 业务验收记录（{@code dtl_demand_acceptance}）。一轮一条，历史不被覆盖。
 *
 * <p>没有 UPDATE 也没有 DELETE，与评审记录同一条理由：一条验收记录是「当时线下验收的结论」，
 * 允许改就不再是结论。需求主表上的验收字段存的是最新一轮的值。
 */
@Mapper
public interface DemandAcceptanceMapper {

    /**
     * 下一轮轮次 = 已有记录数 + 1。
     *
     * <p>调用方必须先锁住需求主表那一行（{@code DemandMapper.lockById}）：共享账号下两名运营
     * 同时录入结论会算出两个第 2 轮，撞在 {@code uk_demand_acceptance_round} 上，运营看到的
     * 是一次没有解释的失败。
     */
    @Select("""
            SELECT COALESCE(MAX(round_no), 0) + 1 FROM dtl_demand_acceptance
             WHERE demand_id = #{demandId} AND deleted = FALSE
            """)
    int nextRoundNo(@Param("demandId") long demandId);

    @Select("""
            INSERT INTO dtl_demand_acceptance (demand_id, round_no, acceptor_name, accepted_at,
                                               acceptance_result, acceptance_opinion,
                                               created_by, updated_by)
            VALUES (#{demandId}, #{roundNo}, #{acceptorName}, #{acceptedAt},
                    #{acceptanceResult}, #{acceptanceOpinion}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("demandId") long demandId,
                @Param("roundNo") int roundNo,
                @Param("acceptorName") String acceptorName,
                @Param("acceptedAt") LocalDate acceptedAt,
                @Param("acceptanceResult") String acceptanceResult,
                @Param("acceptanceOpinion") String acceptanceOpinion,
                @Param("operator") String operator);

    /** 详情页「业务验收」页签，最新一轮在前。 */
    @Select("""
            SELECT id, demand_id, round_no, acceptor_name, accepted_at,
                   acceptance_result, acceptance_opinion, created_at, created_by
              FROM dtl_demand_acceptance
             WHERE demand_id = #{demandId} AND deleted = FALSE
             ORDER BY round_no DESC
            """)
    List<DemandAcceptance> findByDemand(@Param("demandId") long demandId);
}
