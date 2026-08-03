package com.aiacademy.business.training.domain;

import java.util.List;

/**
 * 培训归档三类附件在 {@code sys_attachment_ref.ref_field} 上的取值（需求 11.6）。
 *
 * <p>前后端拿同一份字符串挂附件与查附件。写成常量而不是各写各的字面量：拼错一个字符不会报错，
 * 只会表现为「传上去的照片在页面上看不见」——附件已经落盘、引用也写进去了，只是查的时候
 * 用的是另一个 {@code ref_field}。
 */
public final class ArchiveAttachmentFields {

    /** 现场照片。需求 11.6 限图片格式，格式白名单由附件上传接口按扩展名判定。 */
    public static final String PHOTOS = "archive_photos";

    /** 课程PPT。 */
    public static final String PPT = "archive_ppt";

    /** 培训纪要的附件部分，正文在 {@code dtl_training_archive.minutes_text}。 */
    public static final String MINUTES = "archive_minutes";

    public static final List<String> ALL = List.of(PHOTOS, PPT, MINUTES);

    private ArchiveAttachmentFields() {
    }
}
