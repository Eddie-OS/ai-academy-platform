package com.aiacademy.platform.storage.domain;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;

/**
 * 附件挂在哪类业务对象上。两个用途：拼存储目录（开发 5.7.3）与写 {@code sys_attachment_ref.ref_type}。
 *
 * <p><b>取值必须与需求 5.11 的「对象类型」枚举一致</b>，因为同一份对象类型词表还用在状态流转日志
 * 与操作审计日志上。不一致的后果是详情页拿 {@code ref_type = 'COURSE'} 查不到用
 * {@code 'Course'} 写进去的附件——而这种错误只会在页面上表现为「附件列表是空的」，不报任何错。
 * {@code AttachmentOwnerTypeTest} 拿状态机的对象类型清单逐个对账。
 *
 * <p>目录名是小写形式，对应开发 5.7.3 的 {@code /data/attachment/course/202608/...}。
 */
public enum AttachmentOwnerType {

    DEMAND("demand"),
    COURSE("course"),
    COURSE_REVIEW("course_review"),
    COURSE_TRIAL("course_trial"),
    TRAINING_PLAN("training_plan"),
    TRAINING_SESSION("training_session"),
    CASE("case"),
    TASK("task"),
    /** 讲师没有状态机，但头像要挂附件。词表比状态机对象多这一项，见 AttachmentOwnerTypeTest。 */
    LECTURER("lecturer");

    private final String directory;

    AttachmentOwnerType(String directory) {
        this.directory = directory;
    }

    public String directory() {
        return directory;
    }

    public static AttachmentOwnerType of(String code) {
        for (AttachmentOwnerType type : values()) {
            if (type.name().equalsIgnoreCase(code)) {
                return type;
            }
        }
        throw new BizException(ErrorCode.PARAM_INVALID, "未知的对象类型：" + code);
    }
}
