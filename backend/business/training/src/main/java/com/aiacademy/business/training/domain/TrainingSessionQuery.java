package com.aiacademy.business.training.domain;

import com.aiacademy.common.api.PageQuery;

import java.time.LocalDate;

/**
 * 培训场次列表与排期日历的筛选条件（需求 11.9、11.8 P4-1）。
 *
 * <p>日历页与列表页共用一套筛选：日历只是把同一批场次按培训日期铺开，各带一套筛选参数会让
 * 「日历上看得见、列表里搜不到」这类不一致悄悄发生。日历按月取数时传 {@code dateFrom}／
 * {@code dateTo} 与一个大 {@code pageSize}。
 */
public class TrainingSessionQuery extends PageQuery {

    private String keyword;

    private Long planId;

    private Long courseId;

    private Long lecturerId;

    private String sessionState;

    private String trainingForm;

    private LocalDate dateFrom;

    private LocalDate dateTo;

    /** 是否已导入签到（需求 11.9）。null 表示不筛选。 */
    private Boolean attendanceImported;

    private String sortBy;

    private Boolean sortAsc;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public Long getPlanId() {
        return planId;
    }

    public void setPlanId(Long planId) {
        this.planId = planId;
    }

    public Long getCourseId() {
        return courseId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }

    public Long getLecturerId() {
        return lecturerId;
    }

    public void setLecturerId(Long lecturerId) {
        this.lecturerId = lecturerId;
    }

    public String getSessionState() {
        return sessionState;
    }

    public void setSessionState(String sessionState) {
        this.sessionState = sessionState;
    }

    public String getTrainingForm() {
        return trainingForm;
    }

    public void setTrainingForm(String trainingForm) {
        this.trainingForm = trainingForm;
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

    public Boolean getAttendanceImported() {
        return attendanceImported;
    }

    public void setAttendanceImported(Boolean attendanceImported) {
        this.attendanceImported = attendanceImported;
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

    /** 白名单化的排序列。默认按培训日期降序（需求 11.9「默认按培训日期降序」）。 */
    public String sortColumn() {
        if (sortBy == null) {
            return "training_date";
        }
        return switch (sortBy) {
            case "sessionNo" -> "session_no";
            case "sessionName" -> "session_name";
            case "startTime" -> "start_time";
            case "lastStateChangedAt" -> "last_state_changed_at";
            default -> "training_date";
        };
    }

    public String sortDirection() {
        return Boolean.TRUE.equals(sortAsc) ? "ASC" : "DESC";
    }
}
