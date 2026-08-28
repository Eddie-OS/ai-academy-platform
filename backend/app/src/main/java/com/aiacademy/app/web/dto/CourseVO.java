package com.aiacademy.app.web.dto;

import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.business.course.domain.CourseListItem;
import com.aiacademy.business.course.domain.CourseSelfcheckSpec;
import com.aiacademy.common.json.JsonArrays;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 课程列表行与详情的出参（需求 9.10 的默认展示列 + 可选列）。
 *
 * <p>与实体分开，为的是两件事：{@code qualityMarks} 在库里是 JSONB 文本、对外必须是数组；
 * 有效期的三个派生字段是算出来的，不该看起来像列。灯色由 app 层实时装配（阶段 3B）。
 *
 * @param validityStatus 有效期状态：有效 / 30 天内到期 / 已过期 / 长期有效 / 未发布（规则 EX7 实时计算）
 * @param daysToExpiry   距到期天数。长期有效与未发布时为 null，已过期时为负数
 * @param light          灯色 API 码 BLUE／YELLOW／RED／NONE
 * @param lightDays      与灯色配套的天数；无灯时为 null
 * @param lightReason    红灯原因文案；非红灯为 null
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
        String source,
        String remark,
        String initiationNo,
        String businessPain,
        String courseGoal,
        String courseValue,
        String outlineSummary,
        BigDecimal estimateDevDays,
        String reviewJudges,
        LocalDate initiationReviewDate,
        String initiationReviewConclusion,
        String initiationReviewOpinion,
        String initiationStatus,
        LocalDate planDraftDate,
        LocalDate actualDraftDate,
        String enterSelfCheck,
        String selfcheckCheckerNo,
        LocalDate selfcheckCompletedDate,
        String selfcheckConclusion,
        String selfcheckRecordStatus,
        String submitExpertReview,
        Map<String, String> selfcheckSpecAnswers,
        String reviewRoundLabel,
        LocalDate reviewCompletedDate,
        String reviewLedgerPhase,
        String reviewLedgerStatus,
        String enterTrial,
        String prelimRoundLabel,
        String prelimReviewers,
        LocalDate prelimReviewDate,
        LocalDate prelimCompletedDate,
        String prelimConclusion,
        String prelimOpinion,
        String enterMeeting,
        String meetingRoundLabel,
        String meetingReviewers,
        LocalDate meetingActualDate,
        String meetingConclusion,
        String meetingOpinion,
        String trialLecturerNo,
        String trialCurrentPhase,
        String trialLedgerStatus,
        String trialRoundLabel,
        LocalDate trialScheduledDate,
        String trialAudienceGroup,
        String trialAudienceCount,
        BigDecimal trialHours,
        String trialFormat,
        String trialSatisfaction,
        String trialOptimizeAdvice,
        String trialAcceptanceResult,
        String trialReadyToPublish,
        String trialLecturerQualified,
        LocalDate trialConclusionDate,
        String trialRemark,
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
        String reviewRecordState,
        Boolean hasDemand,
        OffsetDateTime lastStateChangedAt,
        OffsetDateTime updatedAt,
        String updatedBy,
        Integer version,
        String light,
        Integer lightDays,
        String lightReason) {

    public static CourseVO of(CourseListItem c, WarningLightView light) {
        return new CourseVO(
                c.getId(), c.getCourseNo(), c.getCourseName(), c.getReviewTrack(), c.getDomainCode(),
                c.getOwnerNo(), c.getOwnerName(), c.getInitiatedDate(), c.getExpectPublishDate(),
                c.getSummary(), c.getTargetAudience(), c.getClassHours(), c.getCategoryCode(),
                c.getSource(), c.getRemark(),
                c.getInitiationNo(), c.getBusinessPain(), c.getCourseGoal(), c.getCourseValue(),
                c.getOutlineSummary(), c.getEstimateDevDays(), c.getReviewJudges(),
                c.getInitiationReviewDate(), c.getInitiationReviewConclusion(),
                c.getInitiationReviewOpinion(), c.getInitiationStatus(),
                c.getPlanDraftDate(), c.getActualDraftDate(), c.getEnterSelfCheck(),
                c.getSelfcheckCheckerNo(), c.getSelfcheckCompletedDate(), c.getSelfcheckConclusion(),
                c.getSelfcheckRecordStatus(), c.getSubmitExpertReview(),
                CourseSelfcheckSpec.fromJson(c.getSelfcheckSpecAnswers()),
                c.getReviewRoundLabel(), c.getReviewCompletedDate(), c.getReviewLedgerPhase(),
                c.getReviewLedgerStatus(), c.getEnterTrial(), c.getPrelimRoundLabel(),
                c.getPrelimReviewers(), c.getPrelimReviewDate(), c.getPrelimCompletedDate(),
                c.getPrelimConclusion(), c.getPrelimOpinion(), c.getEnterMeeting(),
                c.getMeetingRoundLabel(), c.getMeetingReviewers(), c.getMeetingActualDate(),
                c.getMeetingConclusion(), c.getMeetingOpinion(),
                c.getTrialLecturerNo(), c.getTrialCurrentPhase(), c.getTrialLedgerStatus(),
                c.getTrialRoundLabel(), c.getTrialScheduledDate(), c.getTrialAudienceGroup(),
                c.getTrialAudienceCount(), c.getTrialHours(), c.getTrialFormat(),
                c.getTrialSatisfaction(), c.getTrialOptimizeAdvice(), c.getTrialAcceptanceResult(),
                c.getTrialReadyToPublish(), c.getTrialLecturerQualified(),
                c.getTrialConclusionDate(), c.getTrialRemark(),
                c.getValidityPeriod(), c.getValidityEndDate(), c.getValidityStatus(), c.getExpired(),
                c.getDaysToExpiry(), c.getExternalLink(), c.getMainState(), c.getDevState(),
                c.getSelfcheckState(), c.getTrialState(), c.getPublishState(), c.getFirstPublishDate(),
                JsonArrays.toList(c.getQualityMarks()), c.getCloseReason(),
                c.getCurrentMaterialVersion(), c.getReviewRound(), c.getReviewRecordState(),
                c.getHasDemand(),
                c.getLastStateChangedAt(), c.getUpdatedAt(), c.getUpdatedBy(), c.getVersion(),
                light.light(), light.days(), light.reason());
    }
}
