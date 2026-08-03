package com.aiacademy.business.course.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 课程评审记录（需求 9.6.1）。多轮独立留档、不设上限、历史不被覆盖（规则 R5、议题 7）。
 *
 * @param roundNo 评审轮次 = 该课程已有评审记录数 + 1。表上有 UNIQUE (course_id, round_no)
 *                作为并发下的最后一道防线
 * @param boundVersionNo 提交评审时的材料版本号快照（规则 R7）。{@code versionId} 是关联，
 *                       这一列是展示用的冗余——版本被删也还能显示评的是哪一版
 * @param reviewForms 评审形式，JSONB 里的中文值数组。对外由 VO 转成数组
 * @param recordState 记录状态：待录入结论 / 已完成（需求 5.5）。由状态机写，不在这里改
 */
public record CourseReview(
        Long id,
        Long courseId,
        Integer roundNo,
        Long versionId,
        String boundVersionNo,
        String reviewForms,
        LocalDate reviewDate,
        String participants,
        String reviewResult,
        String reviewOpinion,
        String issueList,
        String recordState,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}
