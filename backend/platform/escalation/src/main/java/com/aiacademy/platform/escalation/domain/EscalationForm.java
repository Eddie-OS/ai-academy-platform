package com.aiacademy.platform.escalation.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

/**
 * 「标记已催办」入参（需求 13.5.1、开发 5.8.4）。
 */
public record EscalationForm(
        @NotBlank String objectType,
        @NotNull Long objectId,
        @NotBlank @Size(max = 200) String objectName,
        @Size(max = 50) String ownerNo,
        @Size(max = 50) String ownerName,
        @NotBlank String escalateType,
        @Size(max = 64) String channelNote,
        @Size(max = 500) String remark,
        OffsetDateTime escalatedAt,
        @Size(max = 64) String processNode,
        @Size(max = 16) String light,
        @Size(max = 32) String source,
        @Size(max = 2000) String content,
        Boolean force
) {
}
