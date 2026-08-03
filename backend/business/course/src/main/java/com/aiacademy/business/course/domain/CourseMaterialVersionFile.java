package com.aiacademy.business.course.domain;

/**
 * 版本快照里的一个文件（规则 R7）。
 *
 * @param fileNameSnapshot 快照当时的文件名。<b>刻意冗余</b>：附件被逻辑删除后，历史版本仍要
 *                         显示「当时这个版本里有哪些文件」。评审记录绑定版本的意义就在于
 *                         「一年后翻开这条记录，看到的是当时评的那份材料」
 * @param attachmentDeleted 附件是否已被逻辑删除。前端据此把下载入口置灰并给出说明，
 *                          而不是让运营点了才发现下不动
 */
public record CourseMaterialVersionFile(
        Long id,
        Long versionId,
        String materialType,
        Long attachmentId,
        String fileNameSnapshot,
        Integer seqNo,
        Boolean attachmentDeleted) {
}
