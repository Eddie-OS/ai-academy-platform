package com.aiacademy.business.course.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 试讲记录（需求 9.7.1）。一门课程可以有多轮，轮次 = 已有记录数 + 1（规则 R6）。
 *
 * @param courseConclusion 课程试讲结论，驱动课程主状态
 * @param lecturerConclusion 讲师试讲结论，驱动讲师试讲合格标记。<b>与课程结论相互独立</b>
 *                           （议题 17）：一轮试讲完全可能课程合格而讲师不合格
 * @param inconsistent 结论不一致标记。<b>数据库生成列，应用层不写</b>（开发 6.3.4）。
 *                     不一致时系统只做提示，<b>不做任何自动处置</b>（需求 9.7.3）
 * @param acceptanceChecks 验收标准勾选，JSONB 里的中文值数组。按评审轨道动态展示（需求 9.7.2），
 *                         <b>不做「必须全勾才能判合格」的校验</b>——结论由线下验收会给出
 */
public record CourseTrial(
        Long id,
        Long courseId,
        Integer roundNo,
        LocalDate trialDate,
        Long lecturerId,
        String participants,
        String acceptanceChecks,
        String courseConclusion,
        String lecturerConclusion,
        Boolean inconsistent,
        String expertOpinion,
        String issueList,
        String recordState,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}
