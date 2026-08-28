package com.aiacademy.business.demand.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 详情「分流与处理」整页保存。
 *
 * <p>流转去向只允许两条处理出口（不含驳回）。状态变更按转换表一跳一跳走，不自动连跳。
 *
 * @param version 乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record DemandProcessInfoForm(
        @NotBlank(message = "请选择流转去向")
        String outlet,

        @Size(max = 200, message = "解决方案名称不超过 200 字")
        String solutionName,

        String solutionState,

        String solutionRemark,

        @Size(max = 200, message = "需求开发名称不超过 200 字")
        String devName,

        String devState,

        String devRemark,

        LocalDate expectFinishDate,

        String acceptanceState,

        String acceptanceRemark,

        String deliveryMark,

        String deliveryRemark,

        LocalDate actualFinishDate,

        @Size(max = 2000, message = "关联链接不超过 2000 字")
        String solutionLink,

        Integer version) {
}
