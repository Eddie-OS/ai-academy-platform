package com.aiacademy.business.course.domain;

import com.aiacademy.common.api.PageQuery;

import java.time.LocalDate;

/**
 * 课程列表的筛选条件（需求 9.10）。
 *
 * <p>灯色筛选走数据库 {@code calc_light}（阶段 3A），阈值来自 {@code cfg_warning_threshold}。
 * 导出接口复用同一查询对象（开发 5.11.2）。
 */
public class CourseQuery extends PageQuery {

    /** 关键字，匹配课程ID、课程名称、课程简介三列（需求 9.10）。 */
    private String keyword;

    /** 灯色筛选。取值 {@code BLUE}/{@code YELLOW}/{@code RED}/{@code NONE}。 */
    private String light;

    private String reviewTrack;

    private String domainCode;

    /** 课程分类（列表「课程类型」筛选项）。 */
    private String categoryCode;

    private String mainState;

    private String devState;

    private String selfcheckState;

    private String trialState;

    /**
     * 最新一轮评审记录的状态（待录入结论 / 已完成）。
     *
     * <p>课程没有「评审子状态」列：评审轮次挂在 {@code dtl_course_review} 上。
     * 列表「评审状态」筛的是最新一轮，不是主状态「评审决策」。
     */
    private String reviewRecordState;

    /**
     * 子状态。四组子状态共用这一个入参，因为它们的取值域两两不相交
     * （待开发/开发中/自检中、自检完成、待试讲/试讲中/待发布、已发布），
     * 拆成四个筛选框只会让运营在四个下拉里找同一个词。
     */
    private String subState;

    private String ownerNo;

    /** 精品标注。多选字段按「包含即命中」筛选。 */
    private String qualityMark;

    /** 有效期状态，取值见 {@link CourseEnums#VALIDITY_STATUSES}。 */
    private String validityStatus;

    private LocalDate initiatedFrom;

    private LocalDate initiatedTo;

    private LocalDate expectPublishFrom;

    private LocalDate expectPublishTo;

    /** 是否有关联需求（需求 9.10）。null 表示不筛选。 */
    private Boolean hasDemand;

    /** 排序列。默认预计发布时间升序（需求 9.10 的「灯色 + 预计发布时间」在灯色落地前先按后者）。 */
    private String sortBy;

    private Boolean sortAsc;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getLight() {
        return light;
    }

    public void setLight(String light) {
        this.light = light;
    }

    public String getReviewTrack() {
        return reviewTrack;
    }

    public void setReviewTrack(String reviewTrack) {
        this.reviewTrack = reviewTrack;
    }

    public String getDomainCode() {
        return domainCode;
    }

    public void setDomainCode(String domainCode) {
        this.domainCode = domainCode;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public void setCategoryCode(String categoryCode) {
        this.categoryCode = categoryCode;
    }

    public String getDevState() {
        return devState;
    }

    public void setDevState(String devState) {
        this.devState = devState;
    }

    public String getSelfcheckState() {
        return selfcheckState;
    }

    public void setSelfcheckState(String selfcheckState) {
        this.selfcheckState = selfcheckState;
    }

    public String getTrialState() {
        return trialState;
    }

    public void setTrialState(String trialState) {
        this.trialState = trialState;
    }

    public String getReviewRecordState() {
        return reviewRecordState;
    }

    public void setReviewRecordState(String reviewRecordState) {
        this.reviewRecordState = reviewRecordState;
    }

    public String getMainState() {
        return mainState;
    }

    public void setMainState(String mainState) {
        this.mainState = mainState;
    }

    public String getSubState() {
        return subState;
    }

    public void setSubState(String subState) {
        this.subState = subState;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public String getQualityMark() {
        return qualityMark;
    }

    public void setQualityMark(String qualityMark) {
        this.qualityMark = qualityMark;
    }

    public String getValidityStatus() {
        return validityStatus;
    }

    public void setValidityStatus(String validityStatus) {
        this.validityStatus = validityStatus;
    }

    public LocalDate getInitiatedFrom() {
        return initiatedFrom;
    }

    public void setInitiatedFrom(LocalDate initiatedFrom) {
        this.initiatedFrom = initiatedFrom;
    }

    public LocalDate getInitiatedTo() {
        return initiatedTo;
    }

    public void setInitiatedTo(LocalDate initiatedTo) {
        this.initiatedTo = initiatedTo;
    }

    public LocalDate getExpectPublishFrom() {
        return expectPublishFrom;
    }

    public void setExpectPublishFrom(LocalDate expectPublishFrom) {
        this.expectPublishFrom = expectPublishFrom;
    }

    public LocalDate getExpectPublishTo() {
        return expectPublishTo;
    }

    public void setExpectPublishTo(LocalDate expectPublishTo) {
        this.expectPublishTo = expectPublishTo;
    }

    public Boolean getHasDemand() {
        return hasDemand;
    }

    public void setHasDemand(Boolean hasDemand) {
        this.hasDemand = hasDemand;
    }

    public String getSortBy() {
        return sortBy;
    }

    public void setSortBy(String sortBy) {
        this.sortBy = sortBy;
    }

    public Boolean getSortAsc() {
        return sortAsc;
    }

    public void setSortAsc(Boolean sortAsc) {
        this.sortAsc = sortAsc;
    }

    /** 关键字包一层 {@code %}。放在这里而不是 SQL 里，是为了让运营搜含 {@code %} 的课名不会搜出全表。 */
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

    /**
     * 白名单化的排序列。
     *
     * <p>排序列要拼进 SQL，因此<b>必须</b>白名单化：直接用入参拼 {@code ORDER BY} 是注入点。
     * 不在名单里的一律回落到默认列，不报错——排序是展示偏好，为一个拼错的列名让整页查不出来
     * 是过度反应。
     */
    public String sortColumn() {
        if (sortBy == null) {
            return "expect_publish_date";
        }
        return switch (sortBy) {
            case "courseNo" -> "course_no";
            case "courseName" -> "course_name";
            case "initiatedDate" -> "initiated_date";
            case "firstPublishDate" -> "first_publish_date";
            case "validityEndDate" -> "validity_end_date";
            case "lastStateChangedAt" -> "last_state_changed_at";
            default -> "expect_publish_date";
        };
    }

    public String sortDirection() {
        return Boolean.FALSE.equals(sortAsc) ? "DESC" : "ASC";
    }
}
