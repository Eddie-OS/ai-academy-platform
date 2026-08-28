package com.aiacademy.business.lecturer.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 讲师主表 {@code biz_lecturer}（需求 10.3）。
 *
 * <p><b>没有 {@code last_state_changed_at}，也没有 {@code version}。</b>培养状态与在池状态都不是
 * 状态机（规则 TS1、需求 5.13），改值只写操作审计日志、不写流转日志，讲师也不参与三色灯；
 * 乐观锁按规则 K1 只加在需求、课程、案例三张表上。
 *
 * <p><b>累计授课次数、累计学员人次、平均评分不在这里。</b>需求 10.3 第 11–13 项标为「系统自动
 * 生成」，但它们的数据源（培训场次、签到、学员反馈）属于培训模块，实时算即可（C14）。落成列就
 * 要维护刷新，而刷新漏一次的表现是「这位讲师明明上过课，累计次数还是 0」。
 */
@TableName("biz_lecturer")
public class Lecturer {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 讲师ID，规则 JS + 4 位流水（需求 10.3 第 1 项）。 */
    private String lecturerNo;

    private String lecturerName;

    /** 工号，唯一，与人员台账 {@code org_employee} 关联（需求 10.3 第 3 项）。 */
    private String employeeNo;

    /** 来源部门。V1.2 由「部门选择」改为自由文本（N18），只用于展示与筛选。 */
    private String sourceDept;

    /** 擅长领域，JSONB 字符串数组，与需求同一套现场口径；历史行可能仍是作战单元名称。 */
    private String expertiseDomains;

    private String teachingDirection;

    /** 入池方式（需求 10.4）：课程开发人员自动入池 / 运营手动添加 / 批量导入。 */
    private String joinType;

    private LocalDate joinedDate;

    /**
     * 培养状态：待培养 / 培养中 / 可上岗（需求 10.3.1）。
     *
     * <p><b>自由选择，不受顺序约束</b>（TS1）。「可上岗」是排课的硬性前置条件（TS4），
     * 这是本字段唯一驱动业务规则的地方。
     */
    private String trainingState;

    /** 试讲合格标记。由试讲结论录入的副作用写入，与培养状态相互独立（TS5）。 */
    private Boolean trialQualified;

    /** 首次试讲合格时间。「首次到达」型事实，写入一次后不再改。 */
    private LocalDate firstQualifiedDate;

    /** 在池状态：在池 / 已移出（需求 10.3 第 14 项）。 */
    private String poolState;

    private String removedReason;

    private String importBatchNo;

    private OffsetDateTime createdAt;

    private String createdBy;

    private OffsetDateTime updatedAt;

    private String updatedBy;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLecturerNo() {
        return lecturerNo;
    }

    public void setLecturerNo(String lecturerNo) {
        this.lecturerNo = lecturerNo;
    }

    public String getLecturerName() {
        return lecturerName;
    }

    public void setLecturerName(String lecturerName) {
        this.lecturerName = lecturerName;
    }

    public String getEmployeeNo() {
        return employeeNo;
    }

    public void setEmployeeNo(String employeeNo) {
        this.employeeNo = employeeNo;
    }

    public String getSourceDept() {
        return sourceDept;
    }

    public void setSourceDept(String sourceDept) {
        this.sourceDept = sourceDept;
    }

    public String getExpertiseDomains() {
        return expertiseDomains;
    }

    public void setExpertiseDomains(String expertiseDomains) {
        this.expertiseDomains = expertiseDomains;
    }

    public String getTeachingDirection() {
        return teachingDirection;
    }

    public void setTeachingDirection(String teachingDirection) {
        this.teachingDirection = teachingDirection;
    }

    public String getJoinType() {
        return joinType;
    }

    public void setJoinType(String joinType) {
        this.joinType = joinType;
    }

    public LocalDate getJoinedDate() {
        return joinedDate;
    }

    public void setJoinedDate(LocalDate joinedDate) {
        this.joinedDate = joinedDate;
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

    public LocalDate getFirstQualifiedDate() {
        return firstQualifiedDate;
    }

    public void setFirstQualifiedDate(LocalDate firstQualifiedDate) {
        this.firstQualifiedDate = firstQualifiedDate;
    }

    public String getPoolState() {
        return poolState;
    }

    public void setPoolState(String poolState) {
        this.poolState = poolState;
    }

    public String getRemovedReason() {
        return removedReason;
    }

    public void setRemovedReason(String removedReason) {
        this.removedReason = removedReason;
    }

    public String getImportBatchNo() {
        return importBatchNo;
    }

    public void setImportBatchNo(String importBatchNo) {
        this.importBatchNo = importBatchNo;
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
}
