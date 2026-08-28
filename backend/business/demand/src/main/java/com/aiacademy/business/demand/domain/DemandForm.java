package com.aiacademy.business.demand.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 需求登记与编辑表单（需求 8.3.1 的可编辑字段 + 现场口径 D-21）。
 *
 * <p><b>不含状态字段与分流出口。</b>五个状态列只能由状态机引擎写；分流出口随「录入评审结论」
 * 一起录入。
 *
 * <p>九参构造给既有测试与导入路径用；新字段可空，由表单侧做必填。
 */
public record DemandForm(
        @NotBlank(message = "请填写需求名称")
        @Size(max = 100, message = "需求名称不超过 100 字")
        String demandName,

        @NotBlank(message = "请选择或填写所属领域")
        String domainCode,

        @NotBlank(message = "请填写需求提出人")
        String proposerNo,

        @NotBlank(message = "请填写需求负责人")
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

        String priority,

        @Size(max = 2000, message = "业务背景不超过 2000 字")
        String businessBackground,

        @Size(max = 2000, message = "ROI 分析不超过 2000 字")
        String roiAnalysis,

        @Size(max = 2000, message = "备注不超过 2000 字")
        String remark,

        @Size(max = 500, message = "负责人姓名不超过 500 字")
        String ownerNames) {

    public DemandForm(String demandName, String domainCode, String proposerNo, String ownerNo,
                      LocalDate proposedDate, LocalDate expectFinishDate, String description,
                      String demandSource, String demandType, String priority) {
        this(demandName, domainCode, proposerNo, ownerNo, proposedDate, expectFinishDate,
                description, demandSource, demandType, priority, null, null, null, null);
    }
}
