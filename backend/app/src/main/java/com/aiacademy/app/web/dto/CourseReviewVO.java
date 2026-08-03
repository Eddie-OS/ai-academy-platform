package com.aiacademy.app.web.dto;

import com.aiacademy.business.course.domain.CourseReview;
import com.aiacademy.common.json.JsonArrays;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 评审记录的出参（需求 9.6.1）。
 *
 * <p>与实体分开只为一件事：{@code reviewForms} 在库里是 JSONB 文本，对外必须是数组。
 *
 * @param editable 结论是否还没录入。<b>前端据此决定是否渲染录入入口</b>，而不是自己比对状态
 *                 字符串（纪律 STK-1：前端不手写状态值）。已录入的记录一律只读——需求 9.6.1
 *                 表末：任何角色不得修改或删除已完成的评审记录
 */
public record CourseReviewVO(
        Long id,
        Long courseId,
        Integer roundNo,
        Long versionId,
        String boundVersionNo,
        List<String> reviewForms,
        LocalDate reviewDate,
        String participants,
        String reviewResult,
        String reviewOpinion,
        String issueList,
        String recordState,
        boolean editable,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static CourseReviewVO of(CourseReview r) {
        return new CourseReviewVO(r.id(), r.courseId(), r.roundNo(), r.versionId(), r.boundVersionNo(),
                JsonArrays.toList(r.reviewForms()), r.reviewDate(), r.participants(), r.reviewResult(),
                r.reviewOpinion(), r.issueList(), r.recordState(), r.reviewResult() == null,
                r.createdAt(), r.createdBy(), r.updatedAt(), r.updatedBy());
    }
}
