package com.aiacademy.business.demand.domain;

import jakarta.validation.constraints.NotBlank;

/**
 * 详情「评审信息」页签的整页保存（评审状态 / 结论 / 开发优先级 / 意见 / 备注）。
 *
 * <p>评审结论三值映射到分流出口，不另存一套出口字面量。状态变更仍走状态机，
 * 不允许「待评审」直接到「已评审」（中间必须经过「评审中」）。
 *
 * @param version 乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record DemandReviewInfoForm(
        @NotBlank(message = "请选择评审状态")
        String reviewState,

        @NotBlank(message = "请选择评审结论")
        String reviewConclusion,

        @NotBlank(message = "请填写评审意见")
        String reviewOpinion,

        String reviewRemark,

        String priority,

        Integer version) {
}
