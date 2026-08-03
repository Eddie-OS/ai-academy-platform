package com.aiacademy.business.training.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

/**
 * 培训场次主表 {@code biz_training_session}（需求 11.4）。
 *
 * <p><b>{@link #sessionState} 不由本模块写</b>（新建时的初始值除外）：状态列的唯一写入者是
 * 状态机引擎（开发 5.1.4）。
 *
 * <p><b>没有实际签到人数。</b>需求 11.4 第 14 项写的是「签到状态=已签到的记录数」，它是 COUNT
 * 出来的（规则 U2）。落成一列就要在每次导入、每次撤销批次、每次单条改签到时维护，漏一处就
 * 永远错下去，而错了没人看得出来。
 */
@TableName("biz_training_session")
public class TrainingSession {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 场次ID，规则「计划ID + '-' + 2 位场次序号」（需求 11.4 第 1 项）。
     *
     * <p><b>签到、参训名单、学员反馈三类导入模板的关联键都是它</b>（需求 14.4／14.6／14.8）。
     * 因此它一旦重号，影响的不只是本表。
     */
    private String sessionNo;

    private Long planId;

    /** 场次名称。留空时自动生成「计划名称 第N场」（需求 11.4 第 3 项）。 */
    private String sessionName;

    /** 关联课程。随计划带出，允许运营改为其他课程（需求 11.4 第 4 项），改后要重跑排课校验。 */
    private Long courseId;

    /** 授课讲师。只能选培养状态＝可上岗的讲师（规则 TS4、排课校验一）。 */
    private Long lecturerId;

    private LocalDate trainingDate;

    private LocalTime startTime;

    private LocalTime endTime;

    /** 时长（小时），由起止时间算出，可手工覆盖（需求 11.4 第 8 项）。支持 0.5 步进。 */
    private BigDecimal durationHours;

    private String trainingForm;

    private String venue;

    private String onlineLink;

    private String studentScope;

    /** 计划人数。<b>一期不做人数上限校验</b>（议题 23、24、N7）。 */
    private Integer planAttendeeCount;

    private String sessionState;

    private String remark;

    private OffsetDateTime createdAt;

    private String createdBy;

    private OffsetDateTime updatedAt;

    private String updatedBy;

    private OffsetDateTime lastStateChangedAt;

    private Boolean deleted;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSessionNo() {
        return sessionNo;
    }

    public void setSessionNo(String sessionNo) {
        this.sessionNo = sessionNo;
    }

    public Long getPlanId() {
        return planId;
    }

    public void setPlanId(Long planId) {
        this.planId = planId;
    }

    public String getSessionName() {
        return sessionName;
    }

    public void setSessionName(String sessionName) {
        this.sessionName = sessionName;
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

    public LocalDate getTrainingDate() {
        return trainingDate;
    }

    public void setTrainingDate(LocalDate trainingDate) {
        this.trainingDate = trainingDate;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public BigDecimal getDurationHours() {
        return durationHours;
    }

    public void setDurationHours(BigDecimal durationHours) {
        this.durationHours = durationHours;
    }

    public String getTrainingForm() {
        return trainingForm;
    }

    public void setTrainingForm(String trainingForm) {
        this.trainingForm = trainingForm;
    }

    public String getVenue() {
        return venue;
    }

    public void setVenue(String venue) {
        this.venue = venue;
    }

    public String getOnlineLink() {
        return onlineLink;
    }

    public void setOnlineLink(String onlineLink) {
        this.onlineLink = onlineLink;
    }

    public String getStudentScope() {
        return studentScope;
    }

    public void setStudentScope(String studentScope) {
        this.studentScope = studentScope;
    }

    public Integer getPlanAttendeeCount() {
        return planAttendeeCount;
    }

    public void setPlanAttendeeCount(Integer planAttendeeCount) {
        this.planAttendeeCount = planAttendeeCount;
    }

    public String getSessionState() {
        return sessionState;
    }

    public void setSessionState(String sessionState) {
        this.sessionState = sessionState;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
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

    public Boolean getDeleted() {
        return deleted;
    }

    public void setDeleted(Boolean deleted) {
        this.deleted = deleted;
    }
}
