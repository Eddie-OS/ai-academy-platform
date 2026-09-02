package com.aiacademy.business.lecturer.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * 培养计划与培养记录的录入表单。讲师ID／姓名随当前讲师带出，不在这里填。
 */
public record CultivationForm(
        @Size(max = 5000, message = "培养计划不超过 5000 字")
        String planText,

        LocalDate plannedFrom,
        LocalDate plannedTo,

        List<String> cultivationTypes,

        @Size(max = 5000, message = "培养记录不超过 5000 字")
        String recordText,

        LocalDate actualFrom,
        LocalDate actualTo,

        @NotBlank(message = "请选择培养状态")
        String planState,

        @Size(max = 5000, message = "培养评价不超过 5000 字")
        String evaluation,

        @Size(max = 500, message = "备注不超过 500 字")
        String remark) {
}
