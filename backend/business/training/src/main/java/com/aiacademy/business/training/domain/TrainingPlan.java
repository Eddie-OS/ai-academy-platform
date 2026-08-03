package com.aiacademy.business.training.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 培训计划主表 {@code biz_training_plan}（需求 11.3）。
 *
 * <p><b>{@link #planState} 不由本模块写。</b>它由状态机引擎统一写入（开发 5.1.4）。唯一的例外是
 * 新建：计划状态列是 {@code NOT NULL}，初始值必须随 INSERT 一起落库，那一次的流转日志由 app 层
 * 的应用服务在同一事务内补记。
 *
 * <p><b>没有 {@code version}。</b>乐观锁只加在需求、课程、案例三张表上（规则 K1）。培训计划的
 * 编辑冲突面比那三者小得多——计划的字段在场次建起来之后基本不动。
 *
 * <p><b>没有实际场次数。</b>需求 11.3 第 10 项写的是「下属场次记录数」，它是 COUNT 出来的
 * （规则 U2：实时计算，不建预聚合），落成一列就必须在每次建/删场次时维护，漏一处就永远错下去。
 *
 * <p><b>没有 {@code deputy_id}（代理人）。</b>库里保留了这一列，但 V1.2 已删除代理机制（N19）。
 */
@TableName("biz_training_plan")
public class TrainingPlan {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 计划ID，规则 JH + 年月 + 3 位流水（需求 11.3 第 1 项）。场次号以它为前缀。 */
    private String planNo;

    private String planName;

    /**
     * 关联课程（需求 11.3 第 3 项）。
     *
     * <p>只存 ID。<b>课程是否已发布不在计划这一级校验</b>——V1.2 把这项校验移到了场次创建时
     * （需求 11.4.1 校验二）：计划往往在课程还没发布时就先排上了。
     */
    private Long courseId;

    /**
     * 培训负责人工号。
     *
     * <p><b>它不参与判权</b>（需求 11.3 第 4 项、纪律 PMI-4）：能不能写只取决于登录的是哪个账号。
     */
    private String ownerNo;

    /** 面向人群范围，自由文本如「MSS 三层部门全体」（需求 11.3 第 6 项）。 */
    private String targetScope;

    private LocalDate planStartDate;

    /** 计划结束日期。三色灯蓝灯与黄灯的判定基准（需求 11.3 第 8 项）。 */
    private LocalDate planEndDate;

    /** 计划场次数，与实际场次数可以不一致（需求 11.3 第 9 项）。 */
    private Integer planSessionCount;

    private String planState;

    /**
     * 实际完成时间（需求 11.3 第 12 项）。
     *
     * <p>计划状态<b>首次</b>变为「已完成」时写入，退回执行中再次完成时不重写——需求 15.2.1 第 9 项
     * 的「培训计划按时完成率」拿它与计划结束日期比，跟着最后一次走会让一个反复退回的计划看起来
     * 越来越晚完成。
     */
    private LocalDate actualFinishDate;

    private String remark;

    private OffsetDateTime createdAt;

    private String createdBy;

    private OffsetDateTime updatedAt;

    private String updatedBy;

    /** 最后状态变更时间（需求 C5）。红灯停滞判定的唯一依据，与 {@link #updatedAt} 是两回事。 */
    private OffsetDateTime lastStateChangedAt;

    private Boolean deleted;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPlanNo() {
        return planNo;
    }

    public void setPlanNo(String planNo) {
        this.planNo = planNo;
    }

    public String getPlanName() {
        return planName;
    }

    public void setPlanName(String planName) {
        this.planName = planName;
    }

    public Long getCourseId() {
        return courseId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public String getTargetScope() {
        return targetScope;
    }

    public void setTargetScope(String targetScope) {
        this.targetScope = targetScope;
    }

    public LocalDate getPlanStartDate() {
        return planStartDate;
    }

    public void setPlanStartDate(LocalDate planStartDate) {
        this.planStartDate = planStartDate;
    }

    public LocalDate getPlanEndDate() {
        return planEndDate;
    }

    public void setPlanEndDate(LocalDate planEndDate) {
        this.planEndDate = planEndDate;
    }

    public Integer getPlanSessionCount() {
        return planSessionCount;
    }

    public void setPlanSessionCount(Integer planSessionCount) {
        this.planSessionCount = planSessionCount;
    }

    public String getPlanState() {
        return planState;
    }

    public void setPlanState(String planState) {
        this.planState = planState;
    }

    public LocalDate getActualFinishDate() {
        return actualFinishDate;
    }

    public void setActualFinishDate(LocalDate actualFinishDate) {
        this.actualFinishDate = actualFinishDate;
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
