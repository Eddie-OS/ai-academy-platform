package com.aiacademy.business.demand.repository;

import com.aiacademy.business.demand.domain.DemandReview;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/**
 * 需求评审记录（{@code dtl_demand_review}）。多轮留档，历史不被覆盖。
 *
 * <p>没有 UPDATE 也没有 DELETE：与课程评审记录同一条理由——一条评审记录是「当时线下会议的
 * 结论」，允许改就不再是结论，而是一个会被后来的判断覆盖的字段。需求主表上的评审字段存的是
 * 最新一轮的值，改那一份走的是需求编辑。
 */
@Mapper
public interface DemandReviewMapper {

    /**
     * 下一轮轮次 = 已有记录数 + 1。
     *
     * <p>调用方必须先锁住需求主表那一行（{@code DemandMapper.lockById}），否则两名运营同时录入
     * 结论会算出两个第 2 轮，最后撞在 {@code uk_demand_review_round} 上——运营看到的是一次没有
     * 解释的失败。
     */
    @Select("""
            SELECT COALESCE(MAX(round_no), 0) + 1 FROM dtl_demand_review
             WHERE demand_id = #{demandId} AND deleted = FALSE
            """)
    int nextRoundNo(@Param("demandId") long demandId);

    @Select("""
            INSERT INTO dtl_demand_review (demand_id, round_no, review_date, review_conclusion,
                                           review_opinion, created_by, updated_by)
            VALUES (#{demandId}, #{roundNo}, #{reviewDate}, #{reviewConclusion},
                    #{reviewOpinion}, #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("demandId") long demandId,
                @Param("roundNo") int roundNo,
                @Param("reviewDate") LocalDate reviewDate,
                @Param("reviewConclusion") String reviewConclusion,
                @Param("reviewOpinion") String reviewOpinion,
                @Param("operator") String operator);

    /** 详情页「评审信息」页签，最新一轮在前。 */
    @Select("""
            SELECT id, demand_id, round_no, review_date, review_conclusion, review_opinion,
                   created_at, created_by
              FROM dtl_demand_review
             WHERE demand_id = #{demandId} AND deleted = FALSE
             ORDER BY round_no DESC
            """)
    List<DemandReview> findByDemand(@Param("demandId") long demandId);
}
