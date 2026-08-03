package com.aiacademy.business.course.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 课程主表 {@code biz_course}（需求 9.3.1～9.3.3）。
 *
 * <p><b>五个状态列不在这里被写。</b>它们由状态机引擎统一写入（{@code StateTransitionService} 是
 * 全库 16 个状态列的唯一写入者），本实体只读它们。课程服务的更新 SQL 也刻意不包含这五列——
 * 让「改状态必然写流转日志」保持成结构而不是纪律。唯一的例外是新建：主状态的初始值必须随
 * INSERT 一起落库（列是 NOT NULL），那一次的流转日志由 {@code CourseService.create} 显式补写。
 *
 * <p><b>没有 {@code deputy_id}（代理人）。</b>库里保留了这一列，但 V1.2 已删除代理机制（N19）。
 * 实体不声明它，是为了让「不写入」成为写不出来的事，而不是一条要记住的约定。
 *
 * <p><b>没有过期标记与灯色。</b>过期标记按 EX7 实时计算（见 {@link CourseValidity}）；
 * 灯色属于阶段 3 的 aggregate/warning，不落课程表。
 */
@TableName("biz_course")
public class Course {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 课程ID，规则 KC + 年月 + 4 位流水（需求 9.3.1 第 1 项）。 */
    private String courseNo;

    private String courseName;

    /** 内部端到端课程 / 周边领域课程。由线下评审会判定后录入，允许中途修改（议题 8）。 */
    private String reviewTrack;

    /** 所属领域，取作战单元字典的编码。 */
    private String domainCode;

    /**
     * 课程负责人工号。
     *
     * <p><b>它不参与判权</b>（CLAUDE.md 第八节第 1 条、纪律 PMI-4）。共享两账号下能不能写
     * 只取决于登录的是哪个账号，与这个字段是谁无关。任何形如「只有负责人能改」的逻辑都是违规。
     */
    private String ownerNo;

    /** 立项时间。<b>课程开发周期的起点</b>（需求 15.2 的效率指标）。 */
    private LocalDate initiatedDate;

    /** 预计发布时间。三色灯蓝灯与黄灯的判定基准（需求 9.3.1 第 8 项）。 */
    private LocalDate expectPublishDate;

    private String summary;

    private String targetAudience;

    /** 课时（小时），支持 0.5 步进。 */
    private BigDecimal classHours;

    private String categoryCode;

    /** 3 个月 / 6 个月 / 12 个月 / 长期有效（C07）。立项时即需选定，可随时修改。 */
    private String validityPeriod;

    /** 有效期截止日 = 首次发布时间 + 有效期时长；长期有效或未发布时为 null（EX1、EX2、EX8）。 */
    private LocalDate validityEndDate;

    /** 课程视频与直播一律填外链，平台不上传视频文件（N22、D10）。 */
    private String externalLink;

    private String mainState;

    private String devState;

    private String selfcheckState;

    private String trialState;

    private String publishState;

    /** 首次发布时间。既是课程开发周期的终点，也是有效期的起算点（EX1）。 */
    private LocalDate firstPublishDate;

    /** 精品标注，JSONB 值数组：推荐 / 重要 / 精品。Java 侧存 JSON 文本，见 {@code JsonArrays}。 */
    private String qualityMarks;

    private String closeReason;

    /** 当前材料版本号，如 V1、V2（需求 9.5.1）。尚未产生任何版本时为 null。 */
    private String currentMaterialVersion;

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

    public String getCourseNo() {
        return courseNo;
    }

    public void setCourseNo(String courseNo) {
        this.courseNo = courseNo;
    }

    public String getCourseName() {
        return courseName;
    }

    public void setCourseName(String courseName) {
        this.courseName = courseName;
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

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public LocalDate getInitiatedDate() {
        return initiatedDate;
    }

    public void setInitiatedDate(LocalDate initiatedDate) {
        this.initiatedDate = initiatedDate;
    }

    public LocalDate getExpectPublishDate() {
        return expectPublishDate;
    }

    public void setExpectPublishDate(LocalDate expectPublishDate) {
        this.expectPublishDate = expectPublishDate;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getTargetAudience() {
        return targetAudience;
    }

    public void setTargetAudience(String targetAudience) {
        this.targetAudience = targetAudience;
    }

    public BigDecimal getClassHours() {
        return classHours;
    }

    public void setClassHours(BigDecimal classHours) {
        this.classHours = classHours;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public void setCategoryCode(String categoryCode) {
        this.categoryCode = categoryCode;
    }

    public String getValidityPeriod() {
        return validityPeriod;
    }

    public void setValidityPeriod(String validityPeriod) {
        this.validityPeriod = validityPeriod;
    }

    public LocalDate getValidityEndDate() {
        return validityEndDate;
    }

    public void setValidityEndDate(LocalDate validityEndDate) {
        this.validityEndDate = validityEndDate;
    }

    public String getExternalLink() {
        return externalLink;
    }

    public void setExternalLink(String externalLink) {
        this.externalLink = externalLink;
    }

    public String getMainState() {
        return mainState;
    }

    public void setMainState(String mainState) {
        this.mainState = mainState;
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

    public String getPublishState() {
        return publishState;
    }

    public void setPublishState(String publishState) {
        this.publishState = publishState;
    }

    public LocalDate getFirstPublishDate() {
        return firstPublishDate;
    }

    public void setFirstPublishDate(LocalDate firstPublishDate) {
        this.firstPublishDate = firstPublishDate;
    }

    public String getQualityMarks() {
        return qualityMarks;
    }

    public void setQualityMarks(String qualityMarks) {
        this.qualityMarks = qualityMarks;
    }

    public String getCloseReason() {
        return closeReason;
    }

    public void setCloseReason(String closeReason) {
        this.closeReason = closeReason;
    }

    public String getCurrentMaterialVersion() {
        return currentMaterialVersion;
    }

    public void setCurrentMaterialVersion(String currentMaterialVersion) {
        this.currentMaterialVersion = currentMaterialVersion;
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
