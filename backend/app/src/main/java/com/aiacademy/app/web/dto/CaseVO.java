package com.aiacademy.app.web.dto;

import com.aiacademy.business.kase.domain.CaseListItem;
import com.aiacademy.common.json.JsonArrays;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 案例看板卡片与详情的出参（需求 12.3 字段清单 + 12.7 卡片流字段）。
 *
 * <p><b>灯色字段暂缺。</b>三色灯的计算属于阶段 3 的 {@code aggregate/warning}，那时会按 13.4.1a
 * 的阈值统一算出灯色、天数与文案。列表此刻留出这一列的位置但不填值。
 *
 * <p><b>没有收藏数。</b>收藏功能已删除（N21），需求 12.3 第 20 项一并删除。
 *
 * @param courseName    来源课程名称。由 app 层的 {@code CourseRefMapper} 补齐——案例模块不认识
 *                      {@code biz_course}（AR-1）
 * @param avgReadSeconds 平均阅读时长（秒）。没人打开过时是 {@code null}，前端渲染成「—」；
 *                      设计规范 3.3 规定零值才显示 0
 * @param version       乐观锁版本号（规则 K1）。编辑与状态转换都要带回来
 * @param viewId        本次打开所记浏览记录的主键，<b>只有详情接口会填</b>，列表行恒为 null。
 *                      前端在离开页面时拿它回报停留时长（需求 12.3 第 21 项）；不回报也没关系，
 *                      那条浏览记录照样计入浏览次数，只是不进平均阅读时长
 */
public record CaseVO(
        Long id,
        String caseNo,
        String caseName,
        Long courseId,
        String courseName,
        String contributingOrg,
        List<String> contributors,
        List<String> domainCodes,
        String ownerNo,
        String ownerName,
        String caseState,
        String reviewerNo,
        String reviewerName,
        LocalDate reviewedAt,
        String reviewOpinion,
        String reviewResult,
        List<String> qualityMarks,
        String content,
        OffsetDateTime publishedAt,
        LocalDate expectPublishDate,
        Long viewCount,
        Long likeCount,
        Long commentCount,
        Long readSeconds,
        Double avgReadSeconds,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime lastStateChangedAt,
        OffsetDateTime updatedAt,
        String updatedBy,
        Integer version,
        Long viewId) {

    public static CaseVO of(CaseListItem c, String courseName) {
        return of(c, courseName, null);
    }

    public static CaseVO of(CaseListItem c, String courseName, Long viewId) {
        return new CaseVO(
                c.getId(), c.getCaseNo(), c.getCaseName(), c.getCourseId(), courseName,
                c.getContributingOrg(), JsonArrays.toList(c.getContributors()),
                JsonArrays.toList(c.getDomainCodes()), c.getOwnerNo(), c.getOwnerName(),
                c.getCaseState(), c.getReviewerNo(), c.getReviewerName(), c.getReviewedAt(),
                c.getReviewOpinion(), c.getReviewResult(), JsonArrays.toList(c.getQualityMarks()),
                c.getContent(), c.getPublishedAt(), c.getExpectPublishDate(),
                c.getViewCount(), c.getLikeCount(), c.getCommentCount(), c.getReadSeconds(),
                c.getAvgReadSeconds(), c.getCreatedAt(), c.getCreatedBy(),
                c.getLastStateChangedAt(), c.getUpdatedAt(), c.getUpdatedBy(), c.getVersion(),
                viewId);
    }
}
