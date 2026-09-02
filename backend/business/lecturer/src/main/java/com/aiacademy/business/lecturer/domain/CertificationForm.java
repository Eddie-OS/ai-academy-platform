package com.aiacademy.business.lecturer.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 认证记录表单。讲师ID／姓名随当前讲师带出。
 */
public record CertificationForm(
        @Size(max = 64, message = "认证批次不超过 64 字")
        String certBatch,

        String lecturerLevel,

        @NotBlank(message = "请选择认证状态")
        String certState,

        @Size(max = 500, message = "评审人不超过 500 字")
        String reviewers,

        @Size(max = 5000, message = "认证意见不超过 5000 字")
        String opinion,

        LocalDate passedOn,
        LocalDate validFrom,
        LocalDate validTo) {
}
