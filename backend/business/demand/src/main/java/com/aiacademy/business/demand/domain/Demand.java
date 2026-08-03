package com.aiacademy.business.demand.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * AI需求主表 {@code biz_demand}（需求 8.3.1～8.3.4）。
 *
 * <p><b>五个状态列不在这里被写。</b>它们由状态机引擎统一写入（{@code StateTransitionService} 是
 * 全库 16 个状态列的唯一写入者），本实体只读它们。需求服务的更新 SQL 也刻意不包含这五列——
 * 让「改状态必然写流转日志」保持成结构而不是纪律。唯一的例外是新建：评审状态的初始值必须随
 * INSERT 一起落库（列是 NOT NULL），那一次的流转日志由 app 层的应用服务在同一事务内补写。
 *
 * <p><b>没有 {@code deputy_id}（代理人）。</b>库里保留了这一列，但 V1.2 已删除代理机制（N19）。
 * 实体不声明它，是为了让「不写入」成为写不出来的事，而不是一条要记住的约定。
 *
 * <p><b>没有灯色与停滞天数。</b>需求 8.3.5 S4／S5 明确实时计算（13.4.4），不落库；计算本身
 * 属于阶段 3 的 {@code aggregate/warning}。
 *
 * <p><b>交付与归档只有 {@link #deliveryMark} 一列。</b>需求 8.3.4 第 28、35 项写作「交付使用标记 /
 * 归档标记」两个布尔，但需求 5.13 第 5 项把它们归为一个状态机「需求交付标记」（已交付 → 已归档）。
 * 界面上的两个布尔是这一列的表示，拆成两列会与状态机脱钩。
 */
@TableName("biz_demand")
public class Demand {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 需求ID，规则 XQ + 年月 + 4 位流水（需求 8.3.1 第 1 项）。 */
    private String demandNo;

    private String demandName;

    /** 所属领域，取作战单元字典的编码。 */
    private String domainCode;

    private String proposerNo;

    /** 提出人部门，随提出人自动带出的快照文本（需求 8.3.1 第 5 项）。 */
    private String proposerDept;

    /**
     * 需求负责人工号。
     *
     * <p><b>它不参与判权</b>（需求 6.1.3、C04、纪律 PMI-4）。共享两账号下能不能写只取决于登录的
     * 是哪个账号，与这个字段是谁无关。
     */
    private String ownerNo;

    private LocalDate proposedDate;

    /** 预计开发完成时间。三色灯蓝灯与黄灯的判定基准（需求 8.3.1 第 9 项）。 */
    private LocalDate expectFinishDate;

    private String description;

    private String demandSource;

    private String demandType;

    private String priority;

    private String reviewState;

    private LocalDate reviewDate;

    private String reviewConclusion;

    private String reviewOpinion;

    /** 分流出口（需求 5.2.2），只有两值。评审状态变为「已评审」时必填。 */
    private String outlet;

    private String solutionState;

    private String solutionName;

    private String devState;

    /** 首次上线时间。效率指标取此值（需求 8.3.3 第 25 项、规则 E1）。 */
    private LocalDate firstOnlineDate;

    private LocalDate latestOnlineDate;

    private Integer optimizeCount;

    private String deliveryMark;

    private LocalDate deliveredAt;

    private LocalDate archivedAt;

    private String acceptanceState;

    /** 验收人。<b>自由填写文本，不关联人员表</b>——业务接口人可能不在人员表内（需求 5.2.5 第 2 条）。 */
    private String acceptorName;

    private LocalDate acceptedAt;

    private String acceptanceOpinion;

    private Integer acceptanceRound;

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

    /** 乐观锁版本号（规则 K1）。共享账号下冲突是常态而非偶发。 */
    private Integer version;

    @TableLogic
    private Boolean deleted;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDemandNo() {
        return demandNo;
    }

    public void setDemandNo(String demandNo) {
        this.demandNo = demandNo;
    }

    public String getDemandName() {
        return demandName;
    }

    public void setDemandName(String demandName) {
        this.demandName = demandName;
    }

    public String getDomainCode() {
        return domainCode;
    }

    public void setDomainCode(String domainCode) {
        this.domainCode = domainCode;
    }

    public String getProposerNo() {
        return proposerNo;
    }

    public void setProposerNo(String proposerNo) {
        this.proposerNo = proposerNo;
    }

    public String getProposerDept() {
        return proposerDept;
    }

    public void setProposerDept(String proposerDept) {
        this.proposerDept = proposerDept;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public LocalDate getProposedDate() {
        return proposedDate;
    }

    public void setProposedDate(LocalDate proposedDate) {
        this.proposedDate = proposedDate;
    }

    public LocalDate getExpectFinishDate() {
        return expectFinishDate;
    }

    public void setExpectFinishDate(LocalDate expectFinishDate) {
        this.expectFinishDate = expectFinishDate;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDemandSource() {
        return demandSource;
    }

    public void setDemandSource(String demandSource) {
        this.demandSource = demandSource;
    }

    public String getDemandType() {
        return demandType;
    }

    public void setDemandType(String demandType) {
        this.demandType = demandType;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getReviewState() {
        return reviewState;
    }

    public void setReviewState(String reviewState) {
        this.reviewState = reviewState;
    }

    public LocalDate getReviewDate() {
        return reviewDate;
    }

    public void setReviewDate(LocalDate reviewDate) {
        this.reviewDate = reviewDate;
    }

    public String getReviewConclusion() {
        return reviewConclusion;
    }

    public void setReviewConclusion(String reviewConclusion) {
        this.reviewConclusion = reviewConclusion;
    }

    public String getReviewOpinion() {
        return reviewOpinion;
    }

    public void setReviewOpinion(String reviewOpinion) {
        this.reviewOpinion = reviewOpinion;
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

    public String getSolutionName() {
        return solutionName;
    }

    public void setSolutionName(String solutionName) {
        this.solutionName = solutionName;
    }

    public String getDevState() {
        return devState;
    }

    public void setDevState(String devState) {
        this.devState = devState;
    }

    public LocalDate getFirstOnlineDate() {
        return firstOnlineDate;
    }

    public void setFirstOnlineDate(LocalDate firstOnlineDate) {
        this.firstOnlineDate = firstOnlineDate;
    }

    public LocalDate getLatestOnlineDate() {
        return latestOnlineDate;
    }

    public void setLatestOnlineDate(LocalDate latestOnlineDate) {
        this.latestOnlineDate = latestOnlineDate;
    }

    public Integer getOptimizeCount() {
        return optimizeCount;
    }

    public void setOptimizeCount(Integer optimizeCount) {
        this.optimizeCount = optimizeCount;
    }

    public String getDeliveryMark() {
        return deliveryMark;
    }

    public void setDeliveryMark(String deliveryMark) {
        this.deliveryMark = deliveryMark;
    }

    public LocalDate getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(LocalDate deliveredAt) {
        this.deliveredAt = deliveredAt;
    }

    public LocalDate getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(LocalDate archivedAt) {
        this.archivedAt = archivedAt;
    }

    public String getAcceptanceState() {
        return acceptanceState;
    }

    public void setAcceptanceState(String acceptanceState) {
        this.acceptanceState = acceptanceState;
    }

    public String getAcceptorName() {
        return acceptorName;
    }

    public void setAcceptorName(String acceptorName) {
        this.acceptorName = acceptorName;
    }

    public LocalDate getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(LocalDate acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public String getAcceptanceOpinion() {
        return acceptanceOpinion;
    }

    public void setAcceptanceOpinion(String acceptanceOpinion) {
        this.acceptanceOpinion = acceptanceOpinion;
    }

    public Integer getAcceptanceRound() {
        return acceptanceRound;
    }

    public void setAcceptanceRound(Integer acceptanceRound) {
        this.acceptanceRound = acceptanceRound;
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
