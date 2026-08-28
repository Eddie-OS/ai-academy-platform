package com.aiacademy.app.web.dto;

import com.aiacademy.business.demand.domain.DemandReview;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 需求评审记录的出参（详情页「评审信息」页签）。
 *
 * <p>与实体分开，只为让接口契约独立于表结构：这张表的字段清单是从需求 8.3.2 推导出来的
 * （需求文档没有给它字段清单），推导结果日后被业务方修正时，改表不应当直接改契约。
 */
public record DemandReviewVO(
        Long id,
        Long demandId,
        Integer roundNo,
        LocalDate reviewDate,
        String reviewConclusion,
        String reviewOpinion,
        String remark,
        OffsetDateTime createdAt,
        String createdBy) {

    public static DemandReviewVO of(DemandReview r) {
        return new DemandReviewVO(r.id(), r.demandId(), r.roundNo(), r.reviewDate(),
                r.reviewConclusion(), r.reviewOpinion(), r.remark(), r.createdAt(), r.createdBy());
    }
}
