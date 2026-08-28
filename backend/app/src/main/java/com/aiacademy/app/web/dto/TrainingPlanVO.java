package com.aiacademy.app.web.dto;

import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.business.training.domain.TrainingPlanListItem;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 培训计划列表行与详情的出参（需求 11.3 字段清单、11.8 P4-2 默认展示列）。
 *
 * <p>灯色由 app 层按 {@code WarningLightService} 实时装配（阶段 3B）。
 *
 * <p><b>没有版本号。</b>培训计划不在带 {@code version} 的三张表里（规则 K1）。
 *
 * @param courseName         关联课程名称，由 app 层批量补齐（{@code biz_course} 属课程模块，AR-1）
 * @param actualSessionCount 实际场次数（需求 11.3 第 10 项）：下属场次记录数，实时 COUNT
 * @param light              灯色 API 码 BLUE／YELLOW／RED／NONE
 * @param lightDays          与灯色配套的天数；无灯时为 null
 * @param lightReason        红灯原因文案；非红灯为 null
 */
public record TrainingPlanVO(
        Long id,
        String planNo,
        String planName,
        Long courseId,
        String courseName,
        String ownerNo,
        String ownerName,
        String targetScope,
        LocalDate planStartDate,
        LocalDate planEndDate,
        Integer planSessionCount,
        Integer actualSessionCount,
        String planState,
        LocalDate actualFinishDate,
        String remark,
        OffsetDateTime lastStateChangedAt,
        OffsetDateTime updatedAt,
        String updatedBy,
        String light,
        Integer lightDays,
        String lightReason) {

    public static TrainingPlanVO of(TrainingPlanListItem p, String courseName, WarningLightView light) {
        return new TrainingPlanVO(
                p.getId(), p.getPlanNo(), p.getPlanName(), p.getCourseId(), courseName,
                p.getOwnerNo(), p.getOwnerName(), p.getTargetScope(),
                p.getPlanStartDate(), p.getPlanEndDate(),
                p.getPlanSessionCount(), p.getActualSessionCount(),
                p.getPlanState(), p.getActualFinishDate(), p.getRemark(),
                p.getLastStateChangedAt(), p.getUpdatedAt(), p.getUpdatedBy(),
                light.light(), light.days(), light.reason());
    }
}
