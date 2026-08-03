package com.aiacademy.business.training.domain;

import java.time.OffsetDateTime;

/**
 * 一个场次的培训归档记录（需求 11.6）。每个场次至多一条。
 *
 * <p>三类附件（现场照片、课程PPT、纪要附件）不在这里，走通用附件引用
 * {@code sys_attachment_ref}，{@code ref_type = TRAINING_SESSION}，{@code ref_field} 见
 * {@link ArchiveAttachmentFields}。本记录只装标量字段。
 *
 * @param archiveCompleted 归档完成标记。需求 11.6 写的是「置是后场次可转已归档」，
 *                         但按规则 C2 这<b>不是转换的前置校验</b>——它是给运营看的自查标记，
 *                         不阻断「完成归档」这一跳。加了硬校验就会拦住补录历史培训：
 *                         几年前的培训没人会回头补现场照片，但状态必须能置为已归档
 * @param completedAt      标记置为「是」的时刻。不是状态变更，不写状态流转日志
 */
public record TrainingArchive(
        Long id,
        long sessionId,
        String liveLink,
        String videoLink,
        String minutesText,
        boolean archiveCompleted,
        OffsetDateTime completedAt,
        OffsetDateTime updatedAt,
        String updatedBy) {

    /** 场次还没有归档记录时给前端的空壳，省得前端对 null 做一遍判断。 */
    public static TrainingArchive empty(long sessionId) {
        return new TrainingArchive(null, sessionId, null, null, null, false, null, null, null);
    }
}
