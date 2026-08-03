package com.aiacademy.business.demand.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 一条需求评审记录（{@code dtl_demand_review}）。
 *
 * <p><b>需求文档没有给这张表的字段清单</b>：8.3.2「评审信息」把评审字段直接挂在需求主表上。
 * 但 5.2.1 有「重新评审」这条转换（已评审 → 评审中），意味着一个需求会有多轮评审，主表只能存
 * 最新一轮。因此本表按 8.3.2 的字段镜像 + 轮次建模：<b>主表存当前值、本表存历史</b>。
 * 建表脚本 V1_003 的表头注释里已记明这是推导而非照抄。
 *
 * @param roundNo 评审轮次，从 1 起。带 UNIQUE (demand_id, round_no)，并发下不会出现两个第 2 轮
 */
public record DemandReview(
        Long id,
        Long demandId,
        Integer roundNo,
        LocalDate reviewDate,
        String reviewConclusion,
        String reviewOpinion,
        OffsetDateTime createdAt,
        String createdBy) {
}
