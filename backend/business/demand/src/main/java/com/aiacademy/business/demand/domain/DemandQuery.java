package com.aiacademy.business.demand.domain;

import com.aiacademy.common.api.PageQuery;

import java.time.LocalDate;

/**
 * 需求列表的筛选条件（需求 8.6）。
 *
 * <p>灯色筛选走数据库 {@code calc_light}（阶段 3A），阈值来自 {@code cfg_warning_threshold}，
 * 不在业务模块里复制一份判定逻辑。导出接口复用同一查询对象（开发 5.11.2）。
 */
public class DemandQuery extends PageQuery {

    /** 关键字，匹配需求ID、需求名称、需求描述三列（需求 8.6）。 */
    private String keyword;

    /**
     * 灯色筛选。取值 {@code BLUE}/{@code YELLOW}/{@code RED}/{@code NONE}（与 calc_light 返回值一致）。
     */
    private String light;

    private String domainCode;

    private String reviewState;

    private String outlet;

    private String solutionState;

    private String devState;

    private String acceptanceState;

    private String ownerNo;

    private LocalDate proposedFrom;

    private LocalDate proposedTo;

    private LocalDate expectFinishFrom;

    private LocalDate expectFinishTo;

    /** 是否有关联课程（需求 8.4 的双向可查，规则 R4）。null 表示不筛选。 */
    private Boolean hasCourse;

    /** 排序列。默认预计完成时间升序（需求 8.6 的「灯色 + 预计完成时间」在灯色落地前先按后者）。 */
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

    public String getDomainCode() {
        return domainCode;
    }

    public void setDomainCode(String domainCode) {
        this.domainCode = domainCode;
    }

    public String getReviewState() {
        return reviewState;
    }

    public void setReviewState(String reviewState) {
        this.reviewState = reviewState;
    }

    public String getOutlet() {
        return outlet;
    }

    public void setOutlet(String outlet) {
        this.outlet = outlet;
    }

    public String getSolutionState() {
        return solutionState;
    }

    public void setSolutionState(String solutionState) {
        this.solutionState = solutionState;
    }

    public String getDevState() {
        return devState;
    }

    public void setDevState(String devState) {
        this.devState = devState;
    }

    public String getAcceptanceState() {
        return acceptanceState;
    }

    public void setAcceptanceState(String acceptanceState) {
        this.acceptanceState = acceptanceState;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public LocalDate getProposedFrom() {
        return proposedFrom;
    }

    public void setProposedFrom(LocalDate proposedFrom) {
        this.proposedFrom = proposedFrom;
    }

    public LocalDate getProposedTo() {
        return proposedTo;
    }

    public void setProposedTo(LocalDate proposedTo) {
        this.proposedTo = proposedTo;
    }

    public LocalDate getExpectFinishFrom() {
        return expectFinishFrom;
    }

    public void setExpectFinishFrom(LocalDate expectFinishFrom) {
        this.expectFinishFrom = expectFinishFrom;
    }

    public LocalDate getExpectFinishTo() {
        return expectFinishTo;
    }

    public void setExpectFinishTo(LocalDate expectFinishTo) {
        this.expectFinishTo = expectFinishTo;
    }

    public Boolean getHasCourse() {
        return hasCourse;
    }

    public void setHasCourse(Boolean hasCourse) {
        this.hasCourse = hasCourse;
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

    /** 关键字包一层 {@code %}。放在这里而不是 SQL 里，是为了让运营搜含 {@code %} 的需求名不会搜出全表。 */
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
            return "expect_finish_date";
        }
        return switch (sortBy) {
            case "demandNo" -> "demand_no";
            case "demandName" -> "demand_name";
            case "proposedDate" -> "proposed_date";
            case "priority" -> "priority";
            case "deliveredAt" -> "delivered_at";
            case "acceptedAt" -> "accepted_at";
            case "lastStateChangedAt" -> "last_state_changed_at";
            default -> "expect_finish_date";
        };
    }

    public String sortDirection() {
        return Boolean.FALSE.equals(sortAsc) ? "DESC" : "ASC";
    }
}
