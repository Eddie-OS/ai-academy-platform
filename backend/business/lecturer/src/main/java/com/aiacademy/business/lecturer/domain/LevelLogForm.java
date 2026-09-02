package com.aiacademy.business.lecturer.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 等级变更记录表单。编号由系统生成，创建人／更新时间走公共字段。
 */
public record LevelLogForm(
        @Size(max = 200, message = "变更触发原因不超过 200 字")
        String triggerReason,

        @Size(max = 500, message = "等级变更说明不超过 500 字")
        String changeDesc,

        LocalDate changedOn,

        @NotBlank(message = "请选择变更后等级")
        String levelAfter,

        @Size(max = 200, message = "评审人不超过 200 字")
        String reviewer,

        @Size(max = 5000, message = "评审意见不超过 5000 字")
        String reviewComment) {
}
