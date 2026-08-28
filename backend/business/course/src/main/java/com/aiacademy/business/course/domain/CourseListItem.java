package com.aiacademy.business.course.domain;

import java.time.LocalDate;

/**
 * 课程列表的一行（需求 9.10 的默认展示列 + 可选列）。
 *
 * <p>继承 {@link Course} 拿到全部本体字段，本类只加算出来的列：负责人姓名、
 * 当前评审轮次、最新评审记录状态、是否有关联需求、有效期状态。前四个由 SQL 投影，有效期由
 * {@link CourseValidity} 在 Java 侧算——<b>展示口径只有这一份</b>。
 *
 * <p>SQL 里另有一份有效期状态的 CASE 表达式，那份只服务于筛选（筛选条件必须在同一条 SQL 里
 * 才能正确分页）。两份逻辑的一致性由 {@code CourseValidityConsistencyTest} 钉住：
 * 按某个状态筛出来的集合，必须与 Java 算出该状态的集合相等。
 *
 * <p><b>灯色列不在这里。</b>三色灯属于阶段 3，本阶段列表只留出列位置。
 */
public class CourseListItem extends Course {

    /** 负责人姓名，从 {@code org_employee} 带出。<b>负责人不参与判权</b>（纪律 PMI-4）。 */
    private String ownerName;

    /** 当前评审轮次 = 该课程已有评审记录数（需求 9.6.1 第 3 项）。没评审过时为 0。 */
    private Integer reviewRound;

    /**
     * 最新一轮评审记录状态。没开过评审时为 null。
     * 与列表筛选项 {@code reviewRecordState} 同口径，不是立项主状态里的「评审决策」。
     */
    private String reviewRecordState;

    /** 是否有关联需求（需求 9.10 的筛选项之一）。 */
    private Boolean hasDemand;

    private String validityStatus;

    private Boolean expired;

    private Integer daysToExpiry;

    /** 按需求 9.3.1a 算出有效期派生值并回填三个展示字段。 */
    public void applyValidity(LocalDate today) {
        CourseValidity validity = CourseValidity.of(
                getValidityPeriod(), getFirstPublishDate(), getValidityEndDate(), today);
        this.validityStatus = validity.status();
        this.expired = validity.expired();
        this.daysToExpiry = validity.daysToExpiry();
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public Integer getReviewRound() {
        return reviewRound;
    }

    public void setReviewRound(Integer reviewRound) {
        this.reviewRound = reviewRound;
    }

    public String getReviewRecordState() {
        return reviewRecordState;
    }

    public void setReviewRecordState(String reviewRecordState) {
        this.reviewRecordState = reviewRecordState;
    }

    public Boolean getHasDemand() {
        return hasDemand;
    }

    public void setHasDemand(Boolean hasDemand) {
        this.hasDemand = hasDemand;
    }

    public String getValidityStatus() {
        return validityStatus;
    }

    public Boolean getExpired() {
        return expired;
    }

    public Integer getDaysToExpiry() {
        return daysToExpiry;
    }
}
