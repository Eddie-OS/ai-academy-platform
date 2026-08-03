package com.aiacademy.business.course.domain;

import java.time.OffsetDateTime;

/**
 * 课程材料的一条当前引用（需求 9.3.3）。
 *
 * <p>课件、教案、实验材料三类各自可以有多个附件，本记录是「某类材料下的一个附件」。
 * 文件名与大小从 {@code sys_attachment} 带出，不在本表冗余——当前材料指向的是活着的附件，
 * 需要快照的是<b>历史版本</b>，那是 {@link CourseMaterialVersionFile} 的事。
 */
public record CourseMaterial(
        Long id,
        Long courseId,
        String materialType,
        Long attachmentId,
        String fileName,
        Long fileSize,
        Integer seqNo,
        OffsetDateTime createdAt,
        String createdBy) {
}
