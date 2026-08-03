package com.aiacademy.business.lecturer.domain;

import com.aiacademy.common.api.PageQuery;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 讲师池列表的筛选与排序（需求 10.7）。
 *
 * <p>文档规定的八项筛选全在这里：来源部门、擅长领域、培养状态、试讲合格标记、在池状态、
 * 入池方式、入池时间区间、平均评分区间；关键字搜姓名、工号、授课方向三列。
 *
 * <p><b>平均评分区间筛的是算出来的值。</b>平均评分不落库（见 {@link Lecturer} 的说明），
 * 它由学员反馈实时聚合，因此这两个入参要作用在聚合结果上而不是某个列上——
 * 查询本体因此放在 app 层（跨了培训模块的表，AR-1）。
 */
public class LecturerQuery extends PageQuery {

    private String keyword;

    private String sourceDept;

    /** 擅长领域，单值。库里是 JSONB 数组，按「包含即命中」匹配。 */
    private String expertiseDomain;

    private String trainingState;

    private Boolean trialQualified;

    private String poolState;

    private String joinType;

    private LocalDate joinedFrom;

    private LocalDate joinedTo;

    private BigDecimal scoreFrom;

    private BigDecimal scoreTo;

    private String sortBy;

    private Boolean sortAsc;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getSourceDept() {
        return sourceDept;
    }

    public void setSourceDept(String sourceDept) {
        this.sourceDept = sourceDept;
    }

    public String getExpertiseDomain() {
        return expertiseDomain;
    }

    public void setExpertiseDomain(String expertiseDomain) {
        this.expertiseDomain = expertiseDomain;
    }

    public String getTrainingState() {
        return trainingState;
    }

    public void setTrainingState(String trainingState) {
        this.trainingState = trainingState;
    }

    public Boolean getTrialQualified() {
        return trialQualified;
    }

    public void setTrialQualified(Boolean trialQualified) {
        this.trialQualified = trialQualified;
    }

    public String getPoolState() {
        return poolState;
    }

    public void setPoolState(String poolState) {
        this.poolState = poolState;
    }

    public String getJoinType() {
        return joinType;
    }

    public void setJoinType(String joinType) {
        this.joinType = joinType;
    }

    public LocalDate getJoinedFrom() {
        return joinedFrom;
    }

    public void setJoinedFrom(LocalDate joinedFrom) {
        this.joinedFrom = joinedFrom;
    }

    public LocalDate getJoinedTo() {
        return joinedTo;
    }

    public void setJoinedTo(LocalDate joinedTo) {
        this.joinedTo = joinedTo;
    }

    public BigDecimal getScoreFrom() {
        return scoreFrom;
    }

    public void setScoreFrom(BigDecimal scoreFrom) {
        this.scoreFrom = scoreFrom;
    }

    public BigDecimal getScoreTo() {
        return scoreTo;
    }

    public void setScoreTo(BigDecimal scoreTo) {
        this.scoreTo = scoreTo;
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

    /** 关键字包一层 {@code %} 并转义 LIKE 元字符——否则搜一个 {@code %} 会搜出全表。 */
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
     * 白名单化的排序列。排序列要拼进 SQL，直接用入参就是注入点。
     *
     * <p>默认按累计授课次数降序（需求 10.7）。它是聚合出来的别名列而不是表上的列，
     * 因此这里返回的名字必须与查询里的别名一致。
     */
    public String sortColumn() {
        if (sortBy == null) {
            return "teaching_count";
        }
        return switch (sortBy) {
            case "lecturerNo" -> "l.lecturer_no";
            case "lecturerName" -> "l.lecturer_name";
            case "joinedDate" -> "l.joined_date";
            case "trainingState" -> "l.training_state";
            case "attendeeCount" -> "attendee_count";
            case "avgScore" -> "avg_score";
            default -> "teaching_count";
        };
    }

    public String sortDirection() {
        return Boolean.TRUE.equals(sortAsc) ? "ASC" : "DESC";
    }
}
