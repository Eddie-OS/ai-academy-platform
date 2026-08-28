package com.aiacademy.business.course.domain;

import java.time.LocalDate;
import java.util.Map;

/**
 * 课程详情「自检」页基础信息与规格 8 项。
 *
 * <p>不改五个状态列，也不写流转日志。记录状态与总体结论是字典项。
 *
 * @param version 乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record CourseSelfcheckInfoForm(
        String selfcheckCheckerNo,
        LocalDate selfcheckCompletedDate,
        String selfcheckConclusion,
        String selfcheckRecordStatus,
        String submitExpertReview,
        Map<String, String> specAnswers,
        Integer version) {
}
