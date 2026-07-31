package com.aiacademy.platform.storage.domain;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;

/**
 * 附件场景码（规则 F1）。<b>大小上限按业务位置分，不是一个全局配置项。</b>
 *
 * <p>开发 5.7.1 F1 明确「上限按业务位置而非全局配置，需在附件上传接口传入场景码」。
 * 做成全局 20MB 会让课件上不去；做成全局 200MB 会让「需求描述附件」也能塞进 200MB 的压缩包，
 * 而单机 2TB 磁盘经不起这种用法。
 *
 * <p>视频不在这里：需求 N22／F2 规定视频一律填外部链接，不上传（V1.2 移除 mp4/mov）。
 */
public enum AttachmentScene {

    /** 普通附件：需求描述、解决方案、评审纪要、案例材料等（规则 F1 的 20MB 档）。 */
    GENERAL("普通附件", 20L * 1024 * 1024),

    /** 课件（规则 F1 的 200MB 档）。 */
    COURSEWARE("课件", 200L * 1024 * 1024),

    /** 实验材料（规则 F1 的 200MB 档）。 */
    LAB_MATERIAL("实验材料", 200L * 1024 * 1024);

    private final String label;
    private final long maxBytes;

    AttachmentScene(String label, long maxBytes) {
        this.label = label;
        this.maxBytes = maxBytes;
    }

    public String label() {
        return label;
    }

    public long maxBytes() {
        return maxBytes;
    }

    public String maxSizeText() {
        return (maxBytes / 1024 / 1024) + "MB";
    }

    public static AttachmentScene of(String code) {
        for (AttachmentScene scene : values()) {
            if (scene.name().equalsIgnoreCase(code) || scene.label.equals(code)) {
                return scene;
            }
        }
        throw new BizException(ErrorCode.PARAM_INVALID, "未知的附件场景码：" + code);
    }
}
