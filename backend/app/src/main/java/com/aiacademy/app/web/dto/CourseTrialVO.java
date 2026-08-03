package com.aiacademy.app.web.dto;

import com.aiacademy.business.course.domain.CourseTrial;
import com.aiacademy.common.json.JsonArrays;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 试讲记录的出参（需求 9.7.1）。
 *
 * @param lecturerName 讲师姓名。列表上只有 ID 没法看，但讲师在另一个业务模块，
 *                     只能在 app 层查出来拼进来（AR-1）
 * @param inconsistent 结论不一致标记（数据库生成列）。为真时界面要显示需求 9.7.3 规定的那句
 *                     提示：「本轮试讲课程结论与讲师结论不一致，请线下评审后由运营人员维护后续状态」
 * @param editable 结论是否还没录入。已录入的记录一律只读（需求 9.8）
 */
public record CourseTrialVO(
        Long id,
        Long courseId,
        Integer roundNo,
        LocalDate trialDate,
        Long lecturerId,
        String lecturerName,
        String participants,
        List<String> acceptanceChecks,
        String courseConclusion,
        String lecturerConclusion,
        Boolean inconsistent,
        String expertOpinion,
        String issueList,
        String recordState,
        boolean editable,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static CourseTrialVO of(CourseTrial t, String lecturerName) {
        return new CourseTrialVO(t.id(), t.courseId(), t.roundNo(), t.trialDate(), t.lecturerId(),
                lecturerName, t.participants(), JsonArrays.toList(t.acceptanceChecks()),
                t.courseConclusion(), t.lecturerConclusion(), t.inconsistent(), t.expertOpinion(),
                t.issueList(), t.recordState(), t.courseConclusion() == null,
                t.createdAt(), t.createdBy(), t.updatedAt(), t.updatedBy());
    }
}
