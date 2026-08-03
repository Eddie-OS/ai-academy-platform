package com.aiacademy.app.web.dto;

import com.aiacademy.common.api.PageQuery;

import java.time.LocalDate;

/**
 * 试讲台账的筛选与排序（需求 10.2 页面 P3-3：全部课程的试讲记录汇总视图，按轮次与结论筛选）。
 *
 * <p>台账跨了三个对象——试讲记录属课程模块、讲师属讲师模块、课程名来自课程主表，所以查询本体
 * 落在 app 层（AR-4）。它与课程详情页的「试讲记录」页签看的是同一张表，区别只是不限定 course_id。
 */
public class TrialLedgerQuery extends PageQuery {

    /** 关键字：课程名称、讲师姓名、参与人员三列。 */
    private String keyword;

    private Long courseId;

    private Long lecturerId;

    private Integer roundNo;

    /** 课程结论：合格 / 不合格。 */
    private String courseConclusion;

    /** 讲师结论：合格 / 不合格。与课程结论相互独立（需求 9.7.1）。 */
    private String lecturerConclusion;

    /** 只看双结论不一致的记录。这是台账最有价值的一个筛选——它指向需要线下复核的那几条。 */
    private Boolean inconsistent;

    /** 试讲记录状态，取值由 {@code /api/meta/enums} 下发，前端不硬编码（STK-1）。 */
    private String recordState;

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

    public Integer getRoundNo() {
        return roundNo;
    }

    public void setRoundNo(Integer roundNo) {
        this.roundNo = roundNo;
    }

    public String getCourseConclusion() {
        return courseConclusion;
    }

    public void setCourseConclusion(String courseConclusion) {
        this.courseConclusion = courseConclusion;
    }

    public String getLecturerConclusion() {
        return lecturerConclusion;
    }

    public void setLecturerConclusion(String lecturerConclusion) {
        this.lecturerConclusion = lecturerConclusion;
    }

    public Boolean getInconsistent() {
        return inconsistent;
    }

    public void setInconsistent(Boolean inconsistent) {
        this.inconsistent = inconsistent;
    }

    public String getRecordState() {
        return recordState;
    }

    public void setRecordState(String recordState) {
        this.recordState = recordState;
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

    /** 白名单化的排序列，默认按试讲日期倒序——台账要先看最近发生的。 */
    public String sortColumn() {
        if (sortBy == null) {
            return "t.trial_date";
        }
        return switch (sortBy) {
            case "courseName" -> "c.course_name";
            case "lecturerName" -> "l.lecturer_name";
            case "roundNo" -> "t.round_no";
            default -> "t.trial_date";
        };
    }

    public String sortDirection() {
        return Boolean.TRUE.equals(sortAsc) ? "ASC" : "DESC";
    }
}
