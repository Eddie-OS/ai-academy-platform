package com.aiacademy.business.kase.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 案例主表 {@code biz_case}（需求 12.3）。
 *
 * <p>类名不叫 {@code Case}：那是 Java 与 SQL 的保留字。按命名对照表，Java 包名用 {@code kase}、
 * DTO 用 {@code caseInfo}、表名用 {@code biz_case}。
 *
 * <p><b>{@code case_state} 不在这里被写。</b>它由状态机引擎统一写入（{@code StateTransitionService}
 * 是全库 16 个状态列的唯一写入者），本实体只读它。更新 SQL 也刻意不含这一列。唯一的例外是新建：
 * 列是 {@code NOT NULL}，初始状态必须随 INSERT 落库，流转日志由 app 层在同一事务内补记。
 *
 * <p><b>没有 {@code deputy_id}（代理人）。</b>库里保留了这一列，但 V1.2 已删除代理机制（N19）。
 * 实体不声明它，让「不写入」成为写不出来的事。
 *
 * <p><b>没有浏览次数、点赞量、评论数、累计阅读时长。</b>需求 12.3 把这四项标为「A 系统自动生成」，
 * 15.5 给了公式，而三张互动明细表本身就是唯一真相。主表存一份计数器只会与明细漂移——运营删掉
 * 一条评论，计数器不减，页面上就永远差一条。见 {@link CaseInteractionStats}。
 *
 * <p><b>没有灯色与停滞天数。</b>三色灯实时计算（13.4.4），属阶段 3 的 {@code aggregate/warning}。
 */
@TableName("biz_case")
public class CaseInfo {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 案例ID，规则 AL + 年月 + 3 位流水（需求 12.3 第 1 项）。 */
    private String caseNo;

    private String caseName;

    /**
     * 来源课程ID（需求 12.3 第 3 项）。可空且唯一。
     *
     * <p>一期案例<b>仅来自达到精品标准的课程</b>（议题 27、C16-b），因此实际上不会为空；
     * 列可空是给二期的其他来源留的。
     */
    private Long courseId;

    /** 贡献组织。V1.2 由「部门选择」改为自由文本（N18），多个组织用逗号分隔。 */
    private String contributingOrg;

    /** 贡献人工号数组，JSON 文本（需求 12.3 第 5 项，多选）。 */
    private String contributors;

    /** 应用领域，与需求同一套现场口径；历史行可能仍是作战单元编码。 */
    private String domainCodes;

    /**
     * 案例负责人工号。
     *
     * <p><b>不参与判权</b>（需求 12.3 第 7 项「V1.2：仅为数据字段，不决定权限」、纪律 PMI-4）。
     */
    private String ownerNo;

    private String caseState;

    /** 审核人工号（需求 12.3 第 9a 项）。 */
    private String reviewerNo;

    /** 审核时间。线下审核的实际日期，可回填，因此是 DATE 不是时间戳。 */
    private LocalDate reviewedAt;

    private String reviewOpinion;

    /** 审核结论。后一次覆盖前一次，不记轮次（C09 第 4 条）。 */
    private String reviewResult;

    /** 精品标注，多选枚举值数组的 JSON 文本（需求 12.3 第 10 项）。 */
    private String qualityMarks;

    /** 案例正文，富文本，≤20000 字。上架时必填。 */
    private String content;

    /** 上架时间。状态<b>首次</b>变为「已上架」时写入，是案例上架周期的终点（需求 12.3 第 15 项）。 */
    private OffsetDateTime publishedAt;

    /** 预计上架时间。三色灯蓝灯与黄灯的判定基准（IX-3）。纯日期语义，用 DATE。 */
    private LocalDate expectPublishDate;

    private OffsetDateTime createdAt;

    private String createdBy;

    private OffsetDateTime updatedAt;

    private String updatedBy;

    /**
     * 最后状态变更时间（需求 C5），红灯判定的<b>唯一</b>依据。
     *
     * <p>与 {@link #updatedAt} 是两个独立字段，永远不要合并：改一个错别字只更新 updatedAt，
     * 红灯不该因此消失。
     */
    private OffsetDateTime lastStateChangedAt;

    /** 乐观锁版本号（规则 K1）。案例是三张带 version 的表之一。 */
    private Integer version;

    @TableLogic
    private Boolean deleted;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCaseNo() {
        return caseNo;
    }

    public void setCaseNo(String caseNo) {
        this.caseNo = caseNo;
    }

    public String getCaseName() {
        return caseName;
    }

    public void setCaseName(String caseName) {
        this.caseName = caseName;
    }

    public Long getCourseId() {
        return courseId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }

    public String getContributingOrg() {
        return contributingOrg;
    }

    public void setContributingOrg(String contributingOrg) {
        this.contributingOrg = contributingOrg;
    }

    public String getContributors() {
        return contributors;
    }

    public void setContributors(String contributors) {
        this.contributors = contributors;
    }

    public String getDomainCodes() {
        return domainCodes;
    }

    public void setDomainCodes(String domainCodes) {
        this.domainCodes = domainCodes;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public String getCaseState() {
        return caseState;
    }

    public void setCaseState(String caseState) {
        this.caseState = caseState;
    }

    public String getReviewerNo() {
        return reviewerNo;
    }

    public void setReviewerNo(String reviewerNo) {
        this.reviewerNo = reviewerNo;
    }

    public LocalDate getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDate reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewOpinion() {
        return reviewOpinion;
    }

    public void setReviewOpinion(String reviewOpinion) {
        this.reviewOpinion = reviewOpinion;
    }

    public String getReviewResult() {
        return reviewResult;
    }

    public void setReviewResult(String reviewResult) {
        this.reviewResult = reviewResult;
    }

    public String getQualityMarks() {
        return qualityMarks;
    }

    public void setQualityMarks(String qualityMarks) {
        this.qualityMarks = qualityMarks;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public OffsetDateTime getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(OffsetDateTime publishedAt) {
        this.publishedAt = publishedAt;
    }

    public LocalDate getExpectPublishDate() {
        return expectPublishDate;
    }

    public void setExpectPublishDate(LocalDate expectPublishDate) {
        this.expectPublishDate = expectPublishDate;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public OffsetDateTime getLastStateChangedAt() {
        return lastStateChangedAt;
    }

    public void setLastStateChangedAt(OffsetDateTime lastStateChangedAt) {
        this.lastStateChangedAt = lastStateChangedAt;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public Boolean getDeleted() {
        return deleted;
    }

    public void setDeleted(Boolean deleted) {
        this.deleted = deleted;
    }
}
