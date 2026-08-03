package com.aiacademy.business.kase.domain;

import java.time.OffsetDateTime;

/**
 * 一条案例评论（需求 12.4）。
 *
 * @param signature 署名，选填 ≤20 字。<b>留空时这里就是 null</b>，由展示侧渲染成「匿名」——
 *                  落库写「匿名」会让「没填署名」和「署名真的叫匿名」再也分不开
 * @param accountType 账号类型（OPS / USER）。评论是用户账号唯二的写接口之一（需求 6.2.5），
 *                    因此这里会出现 USER
 */
public record CaseComment(long id, long caseId, String signature, String content,
                          OffsetDateTime commentedAt, String accountType) {
}
