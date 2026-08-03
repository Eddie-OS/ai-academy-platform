package com.aiacademy.business.demand.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 录入验收结论的表单（需求 5.2.5 第 2、3 行）。
 *
 * <p>结论只有通过／不通过（{@link DemandEnums#ACCEPTANCE_RESULTS}）加一段文字意见，
 * <b>不做价值量化</b>：不填上线前后的对比数据、不算 ROI（落地要点第 5 条、N14）。
 *
 * <p>{@code acceptanceResult} 决定走哪条转换，因此它必填而不是可空——留空时既不能推到
 * 「验收通过」也不能推到「验收不通过」，那条记录会成为一条谁也解释不了的验收历史。
 *
 * @param acceptorName 验收人。自由文本，不与人员表关联（落地要点第 2 条）
 * @param acceptedAt   线下验收日期，可回填
 * @param version      乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record DemandAcceptanceForm(
        @NotBlank(message = "请填写验收人")
        @Size(max = 50, message = "验收人不超过 50 字")
        String acceptorName,

        @NotNull(message = "请选择验收时间")
        LocalDate acceptedAt,

        @NotBlank(message = "请选择验收结论")
        String acceptanceResult,

        @Size(max = 1000, message = "验收意见不超过 1000 字")
        String acceptanceOpinion,

        Integer version) {
}
