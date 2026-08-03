package com.aiacademy.app.web.dto;

import com.aiacademy.business.kase.domain.CaseComment;

import java.time.OffsetDateTime;

/**
 * 一条评论的出参（需求 12.4）。
 *
 * <p><b>署名为空时这里仍然是 null</b>，「匿名」由前端渲染。后端不替换成「匿名」的理由：那样
 * 一条署名真的写着「匿名」的评论与一条没填署名的评论在接口上完全一样，日后想区分也区分不了。
 */
public record CaseCommentVO(Long id, Long caseId, String signature, String content,
                            OffsetDateTime commentedAt, String accountType) {

    public static CaseCommentVO of(CaseComment c) {
        return new CaseCommentVO(c.id(), c.caseId(), c.signature(), c.content(),
                c.commentedAt(), c.accountType());
    }
}
