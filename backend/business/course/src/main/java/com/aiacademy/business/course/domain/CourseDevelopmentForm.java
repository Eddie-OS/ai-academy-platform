package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 课程详情「开发」页整页保存。
 *
 * <p>不改五个状态列，也不写流转日志。开发状态仍由状态机写入；本表单只记初稿日期、
 * 是否进入自检，以及可手改的负责人。
 *
 * @param version 乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record CourseDevelopmentForm(
        @Size(max = 50, message = "负责人工号不超过 50 字")
        String ownerNo,
        LocalDate planDraftDate,
        LocalDate actualDraftDate,
        @Size(max = 8, message = "是否进入自检只能是「是」或「否」")
        String enterSelfCheck,
        Integer version) {
}
