package com.aiacademy.app.web.dto;

import com.aiacademy.business.training.domain.TrainingSessionListItem;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

/**
 * 培训场次列表行、日历卡片与详情的出参（需求 11.4 字段清单、11.9 默认展示列、11.8 P4-1 卡片）。
 *
 * @param courseName          关联课程名称，由 app 层批量补齐（{@code biz_course} 属课程模块，AR-1）
 * @param lecturerName        授课讲师姓名，同上
 * @param actualAttendeeCount 实际签到人数（需求 11.4 第 14 项）：签到状态＝已签到的记录数，实时 COUNT
 * @param attendanceImported  是否已导入签到（需求 11.9 的筛选项）
 * @param averageScore        学员反馈均分，一位小数；无反馈为 null，界面「—」
 */
public record TrainingSessionVO(
        Long id,
        String sessionNo,
        Long planId,
        String planNo,
        String planName,
        String sessionName,
        Long courseId,
        String courseName,
        String courseIntro,
        Long lecturerId,
        String lecturerName,
        LocalDate trainingDate,
        LocalTime startTime,
        LocalTime endTime,
        BigDecimal durationHours,
        String trainingForm,
        String venue,
        String onlineLink,
        String studentScope,
        Integer planAttendeeCount,
        Integer actualAttendeeCount,
        Boolean attendanceImported,
        String sessionState,
        BigDecimal averageScore,
        String remark,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime lastStateChangedAt,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static TrainingSessionVO of(TrainingSessionListItem s, String courseName,
                                       String courseIntro, String lecturerName) {
        return new TrainingSessionVO(
                s.getId(), s.getSessionNo(), s.getPlanId(), s.getPlanNo(), s.getPlanName(),
                s.getSessionName(), s.getCourseId(), courseName, courseIntro, s.getLecturerId(), lecturerName,
                s.getTrainingDate(), s.getStartTime(), s.getEndTime(), s.getDurationHours(),
                s.getTrainingForm(), s.getVenue(), s.getOnlineLink(), s.getStudentScope(),
                s.getPlanAttendeeCount(), s.getActualAttendeeCount(), s.getAttendanceImported(),
                s.getSessionState(), s.getAverageScore(), s.getRemark(),
                s.getCreatedAt(), s.getCreatedBy(),
                s.getLastStateChangedAt(), s.getUpdatedAt(), s.getUpdatedBy());
    }
}
