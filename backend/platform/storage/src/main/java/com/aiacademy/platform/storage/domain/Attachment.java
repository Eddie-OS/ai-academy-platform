package com.aiacademy.platform.storage.domain;

import java.time.OffsetDateTime;

/**
 * 附件元数据（{@code sys_attachment}，规则 F4）。
 *
 * @param storagePath 本地磁盘<b>相对</b>路径，如 {@code attachment/course/202608/123_第三章课件.pptx}
 * @param sha256 文件摘要，供秒传与去重
 */
public record Attachment(
        long id,
        String fileName,
        long fileSize,
        String contentType,
        String storagePath,
        String sha256,
        OffsetDateTime createdAt,
        String createdBy,
        boolean deleted) {
}
