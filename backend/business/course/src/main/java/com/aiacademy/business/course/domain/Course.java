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

    /** 所属领域，与需求同一套现场口径（零售／MKT 等）；历史行可能仍是作战单元编码。 */
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

    /** 课程来源（立项时录入）。 */
    private String source;

    /** 课程备注。 */
    private String remark;

    /** 立项单号。与 {@link #courseNo} 独立，详情「立项」页展示。 */
    private String initiationNo;

    /** 业务背景与痛点。 */
    private String businessPain;

    /** 课程目标。 */
    private String courseGoal;

    /** 课程价值（ROI）。 */
    private String courseValue;

    /** 初步大纲摘要。 */
    private String outlineSummary;

    /** 预估开发工时，单位天。 */
    private BigDecimal estimateDevDays;

    /** 立项评审责任人／评委姓名，手工录入。 */
    private String reviewJudges;

    /** 立项评审时间。纯日期。 */
    private LocalDate initiationReviewDate;

    /** 立项评审结论，存字典编码。 */
    private String initiationReviewConclusion;

    /** 立项评审意见。 */
    private String initiationReviewOpinion;

    /**
     * 立项状态，存字典编码。
     *
     * <p><b>不是课程主状态。</b>主状态仍由状态机写入；这里只记录规格里的待立项／立项中／已立项。
     */
    private String initiationStatus;

    /** 计划课件初稿完成时间。纯日期，给进度预警与延期判断用。 */
    private LocalDate planDraftDate;

    /** 实际课件初稿完成时间。纯日期，给开发周期与计划达成率用。 */
    private LocalDate actualDraftDate;

    /**
     * 是否进入课程自检环节，存「是」／「否」。
     *
     * <p><b>不写开发状态。</b>选「是」后由前端走状态机「进入自检」，本列只留痕。
     */
    private String enterSelfCheck;

    /** 自检人。 */
    private String selfcheckCheckerNo;

    /** 自检完成时间。纯日期。 */
    private LocalDate selfcheckCompletedDate;

    /** 自检总体结论，存字典编码。 */
    private String selfcheckConclusion;

    /**
     * 自检页手选记录状态，存字典编码。
     *
     * <p><b>不是课程自检子状态。</b>子状态仍由状态机写入。
     */
    private String selfcheckRecordStatus;

    /** 是否提交专家评审，存「是」／「否」。 */
    private String submitExpertReview;

    /** 规格 8 项是否符合要求，JSON 文本。 */
    private String selfcheckSpecAnswers;

    /** 评审页手选轮数，第 1～5 轮。不是自动建档的 {@code round_no}。 */
    private String reviewRoundLabel;

    /** 评审完成时间。纯日期。 */
    private LocalDate reviewCompletedDate;

    /**
     * 当前评审阶段，存字典编码。
     *
     * <p><b>不是状态机。</b>课程主状态仍由评审结论驱动。
     */
    private String reviewLedgerPhase;

    /**
     * 评审页手选台账状态，存字典编码。
     *
     * <p><b>不是评审记录状态。</b>官方记录状态仍是待录入结论／已完成。
     */
    private String reviewLedgerStatus;

    /**
     * 是否进入试讲环节，存「是」／「否」。
     *
     * <p><b>不写课程主状态。</b>正式进入试讲仍须录入本轮评审结论＝通过。
     */
    private String enterTrial;

    private String prelimRoundLabel;

    private String prelimReviewers;

    private LocalDate prelimReviewDate;

    private LocalDate prelimCompletedDate;

    /** 初步评审结论，存字典编码。 */
    private String prelimConclusion;

    private String prelimOpinion;

    /**
     * 是否进入上会评审环节，存「是」／「否」。
     *
     * <p>一期没有上会状态机，本列只留痕。
     */
    private String enterMeeting;

    /** 上会评审轮数，第 1～5 轮。 */
    private String meetingRoundLabel;

    /** 上会评审人员。 */
    private String meetingReviewers;

    /** 实际上会时间。纯日期。 */
    private LocalDate meetingActualDate;

    /**
     * 上会最终结论，存字典编码。
     *
     * <p><b>不是官方评审记录结论。</b>驱动主状态仍须在下方录入结论。
     */
    private String meetingConclusion;

    /** 上会评审意见。 */
    private String meetingOpinion;

    /** 试讲页授课讲师工号。 */
    private String trialLecturerNo;

    /** 试讲当前阶段，存字典编码。不是试讲子状态。 */
    private String trialCurrentPhase;

    /** 试讲页手选台账状态，存字典编码。不是试讲子状态。 */
    private String trialLedgerStatus;

    /** 试讲轮数，第 1～5 轮。不是自动建档的 round_no。 */
    private String trialRoundLabel;

    /** 试讲预定时间。纯日期。 */
    private LocalDate trialScheduledDate;

    /** 试讲面向学员群体。 */
    private String trialAudienceGroup;

    /** 试讲面向学员人数。文本。 */
    private String trialAudienceCount;

    /** 试讲时长，单位小时。 */
    private java.math.BigDecimal trialHours;

    /** 试讲形式，存字典编码。 */
    private String trialFormat;

    /** 整体满意度。 */
    private String trialSatisfaction;

    /** 优化建议。 */
    private String trialOptimizeAdvice;

    /** 试讲验收结果，存字典编码。不是官方试讲结论。 */
    private String trialAcceptanceResult;

    /** 课程是否满足发布要求，是／否。 */
    private String trialReadyToPublish;

    /** 讲师试讲是否合格，是／否。只留痕。 */
    private String trialLecturerQualified;

    /** 试讲结论录入时间。纯日期。 */
    private LocalDate trialConclusionDate;

    /** 试讲结论备注。 */
    private String trialRemark;

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

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public String getInitiationNo() {
        return initiationNo;
    }

    public void setInitiationNo(String initiationNo) {
        this.initiationNo = initiationNo;
    }

    public String getBusinessPain() {
        return businessPain;
    }

    public void setBusinessPain(String businessPain) {
        this.businessPain = businessPain;
    }

    public String getCourseGoal() {
        return courseGoal;
    }

    public void setCourseGoal(String courseGoal) {
        this.courseGoal = courseGoal;
    }

    public String getCourseValue() {
        return courseValue;
    }

    public void setCourseValue(String courseValue) {
        this.courseValue = courseValue;
    }

    public String getOutlineSummary() {
        return outlineSummary;
    }

    public void setOutlineSummary(String outlineSummary) {
        this.outlineSummary = outlineSummary;
    }

    public BigDecimal getEstimateDevDays() {
        return estimateDevDays;
    }

    public void setEstimateDevDays(BigDecimal estimateDevDays) {
        this.estimateDevDays = estimateDevDays;
    }

    public String getReviewJudges() {
        return reviewJudges;
    }

    public void setReviewJudges(String reviewJudges) {
        this.reviewJudges = reviewJudges;
    }

    public LocalDate getInitiationReviewDate() {
        return initiationReviewDate;
    }

    public void setInitiationReviewDate(LocalDate initiationReviewDate) {
        this.initiationReviewDate = initiationReviewDate;
    }

    public String getInitiationReviewConclusion() {
        return initiationReviewConclusion;
    }

    public void setInitiationReviewConclusion(String initiationReviewConclusion) {
        this.initiationReviewConclusion = initiationReviewConclusion;
    }

    public String getInitiationReviewOpinion() {
        return initiationReviewOpinion;
    }

    public void setInitiationReviewOpinion(String initiationReviewOpinion) {
        this.initiationReviewOpinion = initiationReviewOpinion;
    }

    public String getInitiationStatus() {
        return initiationStatus;
    }

    public void setInitiationStatus(String initiationStatus) {
        this.initiationStatus = initiationStatus;
    }

    public LocalDate getPlanDraftDate() {
        return planDraftDate;
    }

    public void setPlanDraftDate(LocalDate planDraftDate) {
        this.planDraftDate = planDraftDate;
    }

    public LocalDate getActualDraftDate() {
        return actualDraftDate;
    }

    public void setActualDraftDate(LocalDate actualDraftDate) {
        this.actualDraftDate = actualDraftDate;
    }

    public String getEnterSelfCheck() {
        return enterSelfCheck;
    }

    public void setEnterSelfCheck(String enterSelfCheck) {
        this.enterSelfCheck = enterSelfCheck;
    }

    public String getSelfcheckCheckerNo() {
        return selfcheckCheckerNo;
    }

    public void setSelfcheckCheckerNo(String selfcheckCheckerNo) {
        this.selfcheckCheckerNo = selfcheckCheckerNo;
    }

    public LocalDate getSelfcheckCompletedDate() {
        return selfcheckCompletedDate;
    }

    public void setSelfcheckCompletedDate(LocalDate selfcheckCompletedDate) {
        this.selfcheckCompletedDate = selfcheckCompletedDate;
    }

    public String getSelfcheckConclusion() {
        return selfcheckConclusion;
    }

    public void setSelfcheckConclusion(String selfcheckConclusion) {
        this.selfcheckConclusion = selfcheckConclusion;
    }

    public String getSelfcheckRecordStatus() {
        return selfcheckRecordStatus;
    }

    public void setSelfcheckRecordStatus(String selfcheckRecordStatus) {
        this.selfcheckRecordStatus = selfcheckRecordStatus;
    }

    public String getSubmitExpertReview() {
        return submitExpertReview;
    }

    public void setSubmitExpertReview(String submitExpertReview) {
        this.submitExpertReview = submitExpertReview;
    }

    public String getSelfcheckSpecAnswers() {
        return selfcheckSpecAnswers;
    }

    public void setSelfcheckSpecAnswers(String selfcheckSpecAnswers) {
        this.selfcheckSpecAnswers = selfcheckSpecAnswers;
    }

    public String getReviewRoundLabel() {
        return reviewRoundLabel;
    }

    public void setReviewRoundLabel(String reviewRoundLabel) {
        this.reviewRoundLabel = reviewRoundLabel;
    }

    public LocalDate getReviewCompletedDate() {
        return reviewCompletedDate;
    }

    public void setReviewCompletedDate(LocalDate reviewCompletedDate) {
        this.reviewCompletedDate = reviewCompletedDate;
    }

    public String getReviewLedgerPhase() {
        return reviewLedgerPhase;
    }

    public void setReviewLedgerPhase(String reviewLedgerPhase) {
        this.reviewLedgerPhase = reviewLedgerPhase;
    }

    public String getReviewLedgerStatus() {
        return reviewLedgerStatus;
    }

    public void setReviewLedgerStatus(String reviewLedgerStatus) {
        this.reviewLedgerStatus = reviewLedgerStatus;
    }

    public String getEnterTrial() {
        return enterTrial;
    }

    public void setEnterTrial(String enterTrial) {
        this.enterTrial = enterTrial;
    }

    public String getPrelimRoundLabel() {
        return prelimRoundLabel;
    }

    public void setPrelimRoundLabel(String prelimRoundLabel) {
        this.prelimRoundLabel = prelimRoundLabel;
    }

    public String getPrelimReviewers() {
        return prelimReviewers;
    }

    public void setPrelimReviewers(String prelimReviewers) {
        this.prelimReviewers = prelimReviewers;
    }

    public LocalDate getPrelimReviewDate() {
        return prelimReviewDate;
    }

    public void setPrelimReviewDate(LocalDate prelimReviewDate) {
        this.prelimReviewDate = prelimReviewDate;
    }

    public LocalDate getPrelimCompletedDate() {
        return prelimCompletedDate;
    }

    public void setPrelimCompletedDate(LocalDate prelimCompletedDate) {
        this.prelimCompletedDate = prelimCompletedDate;
    }

    public String getPrelimConclusion() {
        return prelimConclusion;
    }

    public void setPrelimConclusion(String prelimConclusion) {
        this.prelimConclusion = prelimConclusion;
    }

    public String getPrelimOpinion() {
        return prelimOpinion;
    }

    public void setPrelimOpinion(String prelimOpinion) {
        this.prelimOpinion = prelimOpinion;
    }

    public String getEnterMeeting() {
        return enterMeeting;
    }

    public void setEnterMeeting(String enterMeeting) {
        this.enterMeeting = enterMeeting;
    }

    public String getMeetingRoundLabel() {
        return meetingRoundLabel;
    }

    public void setMeetingRoundLabel(String meetingRoundLabel) {
        this.meetingRoundLabel = meetingRoundLabel;
    }

    public String getMeetingReviewers() {
        return meetingReviewers;
    }

    public void setMeetingReviewers(String meetingReviewers) {
        this.meetingReviewers = meetingReviewers;
    }

    public LocalDate getMeetingActualDate() {
        return meetingActualDate;
    }

    public void setMeetingActualDate(LocalDate meetingActualDate) {
        this.meetingActualDate = meetingActualDate;
    }

    public String getMeetingConclusion() {
        return meetingConclusion;
    }

    public void setMeetingConclusion(String meetingConclusion) {
        this.meetingConclusion = meetingConclusion;
    }

    public String getMeetingOpinion() {
        return meetingOpinion;
    }

    public void setMeetingOpinion(String meetingOpinion) {
        this.meetingOpinion = meetingOpinion;
    }

    public String getTrialLecturerNo() {
        return trialLecturerNo;
    }

    public void setTrialLecturerNo(String trialLecturerNo) {
        this.trialLecturerNo = trialLecturerNo;
    }

    public String getTrialCurrentPhase() {
        return trialCurrentPhase;
    }

    public void setTrialCurrentPhase(String trialCurrentPhase) {
        this.trialCurrentPhase = trialCurrentPhase;
    }

    public String getTrialLedgerStatus() {
        return trialLedgerStatus;
    }

    public void setTrialLedgerStatus(String trialLedgerStatus) {
        this.trialLedgerStatus = trialLedgerStatus;
    }

    public String getTrialRoundLabel() {
        return trialRoundLabel;
    }

    public void setTrialRoundLabel(String trialRoundLabel) {
        this.trialRoundLabel = trialRoundLabel;
    }

    public LocalDate getTrialScheduledDate() {
        return trialScheduledDate;
    }

    public void setTrialScheduledDate(LocalDate trialScheduledDate) {
        this.trialScheduledDate = trialScheduledDate;
    }

    public String getTrialAudienceGroup() {
        return trialAudienceGroup;
    }

    public void setTrialAudienceGroup(String trialAudienceGroup) {
        this.trialAudienceGroup = trialAudienceGroup;
    }

    public String getTrialAudienceCount() {
        return trialAudienceCount;
    }

    public void setTrialAudienceCount(String trialAudienceCount) {
        this.trialAudienceCount = trialAudienceCount;
    }

    public java.math.BigDecimal getTrialHours() {
        return trialHours;
    }

    public void setTrialHours(java.math.BigDecimal trialHours) {
        this.trialHours = trialHours;
    }

    public String getTrialFormat() {
        return trialFormat;
    }

    public void setTrialFormat(String trialFormat) {
        this.trialFormat = trialFormat;
    }

    public String getTrialSatisfaction() {
        return trialSatisfaction;
    }

    public void setTrialSatisfaction(String trialSatisfaction) {
        this.trialSatisfaction = trialSatisfaction;
    }

    public String getTrialOptimizeAdvice() {
        return trialOptimizeAdvice;
    }

    public void setTrialOptimizeAdvice(String trialOptimizeAdvice) {
        this.trialOptimizeAdvice = trialOptimizeAdvice;
    }

    public String getTrialAcceptanceResult() {
        return trialAcceptanceResult;
    }

    public void setTrialAcceptanceResult(String trialAcceptanceResult) {
        this.trialAcceptanceResult = trialAcceptanceResult;
    }

    public String getTrialReadyToPublish() {
        return trialReadyToPublish;
    }

    public void setTrialReadyToPublish(String trialReadyToPublish) {
        this.trialReadyToPublish = trialReadyToPublish;
    }

    public String getTrialLecturerQualified() {
        return trialLecturerQualified;
    }

    public void setTrialLecturerQualified(String trialLecturerQualified) {
        this.trialLecturerQualified = trialLecturerQualified;
    }

    public LocalDate getTrialConclusionDate() {
        return trialConclusionDate;
    }

    public void setTrialConclusionDate(LocalDate trialConclusionDate) {
        this.trialConclusionDate = trialConclusionDate;
    }

    public String getTrialRemark() {
        return trialRemark;
    }

    public void setTrialRemark(String trialRemark) {
        this.trialRemark = trialRemark;
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
