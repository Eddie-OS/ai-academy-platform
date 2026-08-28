package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 课程材料版本台账。只改版本行上的说明字段，不改 {@code version_no}、不删文件、不写流转日志。
 */
public record CourseVersionLedgerForm(
        @Size(max = 64, message = "课程版本号不超过 64 字")
        String versionLabel,
        @Size(max = 64, message = "版本状态不超过 64 字")
        String versionStatus,
        @Size(max = 50, message = "负责人工号不超过 50 字")
        String ownerNo,
        LocalDate updatedDate,
        @Size(max = 500, message = "课件链接不超过 500 字")
        @Pattern(regexp = "^$|^https?://.+", message = "课件链接需以 http:// 或 https:// 开头")
        String coursewareUrl,
        @Size(max = 500, message = "录屏链接不超过 500 字")
        @Pattern(regexp = "^$|^https?://.+", message = "录屏链接需以 http:// 或 https:// 开头")
        String recordingUrl,
        @Size(max = 500, message = "版本说明不超过 500 字")
        String remark) {
}
