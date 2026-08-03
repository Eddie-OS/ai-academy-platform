package com.aiacademy.business.demand.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 需求登记与编辑表单（需求 8.3.1 的可编辑字段）。
 *
 * <p><b>不含状态字段与分流出口。</b>五个状态列只能由状态机引擎写；分流出口随「录入评审结论」
 * 一起录入（需求 5.2.1：评审状态变为「已评审」时必须同时填写分流出口），放进通用编辑表单就
 * 没法表达这个「必须同时」。
 *
 * <p><b>不含提出人部门。</b>它是随提出人自动带出的快照（需求 8.3.1 第 5 项），让运营能手填
 * 就等于允许它与人员台账不一致。
 *
 * <p><b>不含代理人。</b>V1.2 已删除代理机制（N19）。
 */
public record DemandForm(
        @NotBlank(message = "请填写需求名称")
        @Size(max = 100, message = "需求名称不超过 100 字")
        String demandName,

        @NotBlank(message = "请选择所属领域")
        String domainCode,

        @NotBlank(message = "请选择需求提出人")
        String proposerNo,

        @NotBlank(message = "请选择需求负责人")
        String ownerNo,

        @NotNull(message = "请填写提出时间")
        LocalDate proposedDate,

        @NotNull(message = "请填写预计开发完成时间")
        LocalDate expectFinishDate,

        @NotBlank(message = "请填写需求描述")
        @Size(max = 2000, message = "需求描述不超过 2000 字")
        String description,

        String demandSource,

        String demandType,

        String priority) {
}
