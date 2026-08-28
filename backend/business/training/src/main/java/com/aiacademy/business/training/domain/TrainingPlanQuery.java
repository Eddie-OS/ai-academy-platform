package com.aiacademy.business.training.domain;

import com.aiacademy.common.api.PageQuery;

import java.time.LocalDate;

/**
 * 培训计划列表的筛选条件（需求 11.8 P4-2）。
 *
 * <p>文档规定的四项筛选是：关联课程、培训负责人、计划状态、计划起止日期区间。
 * 灯色筛选走数据库 {@code calc_light}（阶段 3B），阈值来自 {@code cfg_warning_threshold}。
 *
 * <p>关键字不在文档的筛选清单里，但列表页要有一个搜索框才能用；它只匹配计划ID与计划名称两列，
 * 不扩到备注——备注是运营的自由文本，搜出一堆无关计划反而更难找。
 */
public class TrainingPlanQuery extends PageQuery {

    private String keyword;

    /** 灯色筛选。取值 {@code BLUE}/{@code YELLOW}/{@code RED}/{@code NONE}。 */
    private String light;

    private Long courseId;

    private String ownerNo;

    private String planState;

    /** 计划起止日期区间：与「计划期间与该区间有重叠」的计划匹配，而不是要求整段落在区间内。 */
    private LocalDate dateFrom;

    private LocalDate dateTo;

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

    public Long getCourseId() {
        return courseId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public String getPlanState() {
        return planState;
    }

    public void setPlanState(String planState) {
        this.planState = planState;
    }

    public LocalDate getDateFrom() {
        return dateFrom;
    }

    public void setDateFrom(LocalDate dateFrom) {
        this.dateFrom = dateFrom;
    }

    public LocalDate getDateTo() {
        return dateTo;
    }

    public void setDateTo(LocalDate dateTo) {
        this.dateTo = dateTo;
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

    /** 关键字包一层 {@code %}，并转义 LIKE 元字符——否则搜一个 {@code %} 会搜出全表。 */
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
     * 白名单化的排序列。排序列要拼进 SQL，直接用入参是注入点；不在名单里的一律回落到默认列。
     *
     * <p>默认按计划开始日期降序（需求 11.8 P4-2「默认按计划开始日期降序」）。
     */
    public String sortColumn() {
        if (sortBy == null) {
            return "plan_start_date";
        }
        return switch (sortBy) {
            case "planNo" -> "plan_no";
            case "planName" -> "plan_name";
            case "planEndDate" -> "plan_end_date";
            case "actualFinishDate" -> "actual_finish_date";
            case "lastStateChangedAt" -> "last_state_changed_at";
            default -> "plan_start_date";
        };
    }

    public String sortDirection() {
        return Boolean.TRUE.equals(sortAsc) ? "ASC" : "DESC";
    }
}
