package com.aiacademy.business.kase.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 发表评论（需求 12.4）。
 *
 * <p>评论与点赞是<b>用户账号唯二能调用的写接口</b>（需求 6.2.5）。
 *
 * @param signature 署名，选填 ≤20 字。共享账号下让评论有归属感的唯一办法——不校验、不关联人员台账，
 *                  使用者敲什么就是什么
 */
public record CaseCommentForm(
        @Size(max = 20, message = "署名不超过 20 字")
        String signature,

        @NotBlank(message = "请填写评论内容")
        @Size(max = 1000, message = "评论内容不超过 1000 字")
        String content) {
}
