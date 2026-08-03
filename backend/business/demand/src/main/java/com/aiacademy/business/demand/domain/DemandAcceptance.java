package com.aiacademy.business.demand.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 一条业务验收记录（{@code dtl_demand_acceptance}，需求 5.2.5、8.3.4）。
 *
 * <p>验收发生在线下——业务接口人当面确认工具或方案能用，平台只记录结论（原则一）。
 *
 * @param roundNo      验收轮次，从 1 起。需求 5.2.5 第 4 行「可反复验收，不设轮次上限」，
 *                     主表的 {@code acceptance_round} 数的是<b>重新提交次数</b>，比本值小 1
 * @param acceptorName 验收人，自由填写文本，<b>不关联人员表</b>——业务接口人可能是平台外的人
 *                     （5.2.5 落地要点第 2 条）
 * @param acceptedAt   线下验收的实际日期，可回填（需求 8.3.4 第 32 项）
 */
public record DemandAcceptance(
        Long id,
        Long demandId,
        Integer roundNo,
        String acceptorName,
        LocalDate acceptedAt,
        String acceptanceResult,
        String acceptanceOpinion,
        OffsetDateTime createdAt,
        String createdBy) {
}
