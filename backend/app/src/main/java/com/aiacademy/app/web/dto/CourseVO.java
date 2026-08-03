package com.aiacademy.app.web.dto;

import com.aiacademy.business.course.domain.CourseListItem;
import com.aiacademy.common.json.JsonArrays;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 课程列表行与详情的出参（需求 9.10 的默认展示列 + 可选列）。
 *
 * <p>与实体分开，为的是两件事：{@code qualityMarks} 在库里是 JSONB 文本、对外必须是数组；
 * 有效期的三个派生字段是算出来的，不该看起来像列。
 *
 * <p><b>灯色字段暂缺。</b>三色灯的计算属于阶段 3 的 {@code aggregate/warning}，那时会按
 * 13.4.1a 的阈值统一算出灯色、天数与文案。列表页此刻留出这一列的位置但不填值——提前在课程模块
 * 里算一遍，等阈值配置界面上线后会出现两套判定，而其中一套不受配置影响。
 *
 * @param validityStatus 有效期状态：有效 / 30 天内到期 / 已过期 / 长期有效 / 未发布（规则 EX7 实时计算）
 * @param daysToExpiry   距到期天数。长期有效与未发布时为 null，已过期时为负数
 * @param version        乐观锁版本号（规则 K1）。编辑与状态转换都要带回来
 */
public record CourseVO(
        Long id,
        String courseNo,
        String courseName,
        String reviewTrack,
        String domainCode,
        String ownerNo,
        String ownerName,
        LocalDate initiatedDate,
        LocalDate expectPublishDate,
        String summary,
        String targetAudience,
        BigDecimal classHours,
        String categoryCode,
        String validityPeriod,
        LocalDate validityEndDate,
        String validityStatus,
        Boolean expired,
        Integer daysToExpiry,
        String externalLink,
        String mainState,
        String devState,
        String selfcheckState,
        String trialState,
        String publishState,
        LocalDate firstPublishDate,
        List<String> qualityMarks,
        String closeReason,
        String currentMaterialVersion,
        Integer reviewRound,
        Boolean hasDemand,
        OffsetDateTime lastStateChangedAt,
        OffsetDateTime updatedAt,
        String updatedBy,
        Integer version) {

    public static CourseVO of(CourseListItem c) {
        return new CourseVO(
                c.getId(), c.getCourseNo(), c.getCourseName(), c.getReviewTrack(), c.getDomainCode(),
                c.getOwnerNo(), c.getOwnerName(), c.getInitiatedDate(), c.getExpectPublishDate(),
                c.getSummary(), c.getTargetAudience(), c.getClassHours(), c.getCategoryCode(),
                c.getValidityPeriod(), c.getValidityEndDate(), c.getValidityStatus(), c.getExpired(),
                c.getDaysToExpiry(), c.getExternalLink(), c.getMainState(), c.getDevState(),
                c.getSelfcheckState(), c.getTrialState(), c.getPublishState(), c.getFirstPublishDate(),
                JsonArrays.toList(c.getQualityMarks()), c.getCloseReason(),
                c.getCurrentMaterialVersion(), c.getReviewRound(), c.getHasDemand(),
                c.getLastStateChangedAt(), c.getUpdatedAt(), c.getUpdatedBy(), c.getVersion());
    }
}
