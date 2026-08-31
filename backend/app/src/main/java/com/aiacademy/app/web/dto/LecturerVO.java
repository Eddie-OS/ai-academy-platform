package com.aiacademy.app.web.dto;

import com.aiacademy.business.lecturer.domain.Lecturer;
import com.aiacademy.business.lecturer.domain.LecturerListItem;
import com.aiacademy.common.json.JsonArrays;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 讲师列表行与详情的出参（需求 10.3 字段清单、10.7 展示列）。
 *
 * <p><b>没有灯色，也没有版本号。</b>讲师不参与三色灯（表上没有 {@code last_state_changed_at}），
 * 乐观锁按规则 K1 只加在需求、课程、案例三张表上。
 *
 * <p>擅长领域在库里是 JSONB 文本，出参转成数组——让前端拿到 {@code ["课程","培训"]} 而不是
 * 一段要它自己再解析一次的字符串。
 *
 * @param teachingCount 累计授课次数（需求 10.3 第 11 项），实时聚合
 * @param attendeeCount 累计学员人次（第 12 项），实时聚合
 * @param avgScore      平均评分（第 13 项）。无反馈时为 null，界面显示「—」而不是 0.0——
 *                      「还没有人评过」与「大家都打 0 分」是两回事（设计规范 3.3）
 */
public record LecturerVO(
        Long id,
        String lecturerNo,
        String lecturerName,
        String employeeNo,
        String sourceDept,
        List<String> expertiseDomains,
        String teachingDirection,
        String joinType,
        LocalDate joinedDate,
        String trainingState,
        Boolean trialQualified,
        LocalDate firstQualifiedDate,
        Integer teachingCount,
        Integer attendeeCount,
        BigDecimal avgScore,
        String poolState,
        String removedReason,
        String importBatchNo,
        Long avatarAttachmentId,
        String avatarPreset,
        String lecturerLevel,
        String capabilityTags,
        String availableTime,
        String dutyState,
        String scheduleLimit,
        String profileMaintainer,
        String remark,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static LecturerVO of(LecturerListItem l) {
        return from(l, l.getTeachingCount(), l.getAttendeeCount(), l.getAvgScore());
    }

    /** 没有统计口径的场合（例如刚创建完回读一次）用这个，三项累计留空。 */
    public static LecturerVO of(Lecturer l) {
        return from(l, null, null, null);
    }

    private static LecturerVO from(Lecturer l, Integer teachingCount, Integer attendeeCount,
                                   BigDecimal avgScore) {
        return new LecturerVO(
                l.getId(), l.getLecturerNo(), l.getLecturerName(), l.getEmployeeNo(),
                l.getSourceDept(), JsonArrays.toList(l.getExpertiseDomains()),
                l.getTeachingDirection(), l.getJoinType(), l.getJoinedDate(),
                l.getTrainingState(), l.getTrialQualified(), l.getFirstQualifiedDate(),
                teachingCount, attendeeCount, avgScore,
                l.getPoolState(), l.getRemovedReason(), l.getImportBatchNo(),
                l.getAvatarAttachmentId(), l.getAvatarPreset(), l.getLecturerLevel(), l.getCapabilityTags(),
                l.getAvailableTime(), l.getDutyState(), l.getScheduleLimit(),
                l.getProfileMaintainer(), l.getRemark(),
                l.getCreatedAt(), l.getUpdatedAt(), l.getUpdatedBy());
    }
}
