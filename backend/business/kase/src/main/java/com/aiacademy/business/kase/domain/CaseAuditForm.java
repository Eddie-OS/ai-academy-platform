package com.aiacademy.business.kase.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 录入案例审核结论（需求 12.3 第 9a～9d 项、需求 5.9 后两行）。
 *
 * <p><b>四个字段一次录完，且与状态转换同一笔事务</b>——三个必填项在需求里都标着「录入结论时 M」。
 * 拆成「先改字段、再点转换」两步，两次请求之间会真实存在一个「已上架但没有审核人」的案例。
 *
 * <p><b>没有轮次。</b>案例审核不记轮次，后一次覆盖前一次（C09 第 4 条）。这与需求的业务验收
 * 刚好相反——那边每一轮都进 {@code dtl_demand_acceptance}。不要把两者做成一样。
 *
 * <p>审核时间是线下审核的<b>实际日期</b>，允许回填，因此是可填字段而不是取录入当天。
 */
public record CaseAuditForm(
        @NotBlank(message = "请选择审核人")
        String reviewerNo,

        @NotNull(message = "请填写审核时间")
        LocalDate reviewedAt,

        @Size(max = 500, message = "审核意见不超过 500 字")
        String reviewOpinion,

        @NotBlank(message = "请选择审核结论")
        String reviewResult,

        Integer version) {
}
