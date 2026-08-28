package com.aiacademy.business.kase.domain;

import com.aiacademy.common.api.PageQuery;

import java.time.LocalDate;

/**
 * 案例看板与列表的筛选条件（需求 12.7）。看板卡片流与运营列表页共用一套：两者取的是同一批数据，
 * 只是渲染成卡片还是表格。
 *
 * <p>没有灯色筛选：案例已退出三色灯范围（业务改版 V-70，见 WarningObjectKind）。
 *
 * <p>导出接口复用同一个查询对象（开发 5.11.2：导出必须复用列表查询的筛选条件，不另写一套）。
 */
public class CaseQuery extends PageQuery {

    /** 关键字，匹配案例名称与案例正文（需求 12.7「关键字搜索」）。 */
    private String keyword;

    /** 应用领域。案例的领域是多选，这里按「包含即命中」筛。 */
    private String domainCode;

    /** 案例状态，含「待审核」（需求 12.7 补充筛选）。 */
    private String caseState;

    /** 贡献组织。自由文本，按包含匹配——它不能聚合成「覆盖了几个部门」（12.5）。 */
    private String contributingOrg;

    /** 精品标注，按「包含即命中」筛。 */
    private String qualityMark;

    private String ownerNo;

    /** 发布时间区间（需求 12.7 维度筛选），比的是上架时间。 */
    private LocalDate publishedFrom;

    private LocalDate publishedTo;

    /** 只看近 30 天有过浏览／点赞／评论的案例（需求 12.7「活跃案例」定义）。null 表示不筛选。 */
    private Boolean activeOnly;

    /** 排序方式，取 {@link CaseEnums#BOARD_SORTS} 四选一。 */
    private String sortBy;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getDomainCode() {
        return domainCode;
    }

    public void setDomainCode(String domainCode) {
        this.domainCode = domainCode;
    }

    public String getCaseState() {
        return caseState;
    }

    public void setCaseState(String caseState) {
        this.caseState = caseState;
    }

    public String getContributingOrg() {
        return contributingOrg;
    }

    public void setContributingOrg(String contributingOrg) {
        this.contributingOrg = contributingOrg;
    }

    public String getQualityMark() {
        return qualityMark;
    }

    public void setQualityMark(String qualityMark) {
        this.qualityMark = qualityMark;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public LocalDate getPublishedFrom() {
        return publishedFrom;
    }

    public void setPublishedFrom(LocalDate publishedFrom) {
        this.publishedFrom = publishedFrom;
    }

    public LocalDate getPublishedTo() {
        return publishedTo;
    }

    public void setPublishedTo(LocalDate publishedTo) {
        this.publishedTo = publishedTo;
    }

    public Boolean getActiveOnly() {
        return activeOnly;
    }

    public void setActiveOnly(Boolean activeOnly) {
        this.activeOnly = activeOnly;
    }

    public String getSortBy() {
        return sortBy;
    }

    public void setSortBy(String sortBy) {
        this.sortBy = sortBy;
    }

    /** 关键字包一层 {@code %}。转义放这里而不是 SQL 里，让搜含 {@code %} 的案例名不会搜出全表。 */
    public String getKeywordLike() {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String escaped = keyword.trim()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }

    public String getContributingOrgLike() {
        if (contributingOrg == null || contributingOrg.isBlank()) {
            return null;
        }
        String escaped = contributingOrg.trim()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }

    /**
     * 白名单化的排序表达式。
     *
     * <p>排序片段要拼进 SQL，因此<b>必须</b>白名单化：直接用入参拼 {@code ORDER BY} 是注入点。
     * 不在名单里的一律回落到「最新」，不报错——排序是展示偏好，为一个拼错的取值让整页查不出来
     * 是过度反应。
     *
     * <p>「推荐」的口径见 {@link CaseEnums#SORT_RECOMMENDED}：有精品标注的在前，同档按最新。
     * 它不是热度公式——共享账号下浏览与点赞只表示「被打开了多少次」，拿它排序会让被反复刷新的
     * 案例长期霸榜。
     */
    public String sortExpression() {
        String sort = sortBy == null ? CaseEnums.SORT_LATEST : sortBy;
        return switch (sort) {
            case CaseEnums.SORT_RECOMMENDED ->
                    "(c.quality_marks IS NOT NULL AND jsonb_array_length(c.quality_marks) > 0) DESC, "
                            + "COALESCE(c.published_at, c.created_at) DESC";
            case CaseEnums.SORT_MOST_LIKED -> "like_count DESC";
            case CaseEnums.SORT_MOST_COMMENTED -> "comment_count DESC";
            default -> "COALESCE(c.published_at, c.created_at) DESC";
        };
    }
}
