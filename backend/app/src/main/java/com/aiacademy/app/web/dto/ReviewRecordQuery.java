package com.aiacademy.app.web.dto;

import java.time.LocalDate;

/**
 * 评审记录中心筛选（需求 13.3.1）。
 */
public class ReviewRecordQuery {

    /** COURSE_REVIEW / COURSE_TRIAL / DEMAND_REVIEW / DEMAND_ACCEPTANCE / CASE_AUDIT / PENDING */
    private String tab;
    private String keyword;
    private String result;
    private LocalDate dateFrom;
    private LocalDate dateTo;
    private String operator;
    private Boolean inconsistent;
    private int pageNum = 1;
    private int pageSize = 20;

    public String getTab() {
        return tab;
    }

    public void setTab(String tab) {
        this.tab = tab;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getResult() {
        return result;
    }

    public void setResult(String result) {
        this.result = result;
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

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public Boolean getInconsistent() {
        return inconsistent;
    }

    public void setInconsistent(Boolean inconsistent) {
        this.inconsistent = inconsistent;
    }

    public int getPageNum() {
        return pageNum;
    }

    public void setPageNum(int pageNum) {
        this.pageNum = pageNum;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = Math.min(Math.max(pageSize, 1), 200);
    }

    public int getOffset() {
        return (Math.max(pageNum, 1) - 1) * pageSize;
    }
}
