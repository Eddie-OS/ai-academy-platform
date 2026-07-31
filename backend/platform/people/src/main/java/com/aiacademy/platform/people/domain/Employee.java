package com.aiacademy.platform.people.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.OffsetDateTime;

/**
 * 人员台账，对应表 {@code org_employee}（需求 14.3）。
 *
 * <p><b>它是一张纯粹的「工号—姓名—在职状态」对照表，不承载任何权限含义</b>：能不能写数据取决于
 * 用哪个共享账号登录，与你在这张表里是谁完全无关（C04）。因此这里没有、也不许加任何角色字段。
 *
 * <p>它没有 {@code last_state_changed_at} 与 {@code version}：人员状态（在职／离职）不是状态机
 * （需求 5.13 的清单里没有它），台账也不是需求／课程／案例三类主对象（规则 K1）。
 */
@TableName("org_employee")
public class Employee {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 工号。人员导入的唯一键：工号已存在则更新其余全部字段（需求 14.3）。 */
    private String employeeNo;

    private String employeeName;

    /** 所属部门。V1.2 起是自由文本、不校验（N18 组织架构整体不做）。 */
    private String deptName;

    private String position;

    /** 邮箱。一期不用于发送（MSG1），只是运营线下联系的参考信息。 */
    private String email;

    /** 讲师 / 学员 / 两者。填「讲师」或「两者」时可被选为授课讲师（需求 14.3、D18）。 */
    private String personType;

    /** 在职 / 离职。离职人员不可被新选为负责人或讲师，但历史签到与反馈记录保留。 */
    private String personState;

    /** 导入批次号，支持整批撤销（需求 13.8.5）。手工新增时为 null。 */
    private String importBatchNo;

    private OffsetDateTime createdAt;

    private String createdBy;

    private OffsetDateTime updatedAt;

    private String updatedBy;

    @TableLogic
    private Boolean deleted;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmployeeNo() {
        return employeeNo;
    }

    public void setEmployeeNo(String employeeNo) {
        this.employeeNo = employeeNo;
    }

    public String getEmployeeName() {
        return employeeName;
    }

    public void setEmployeeName(String employeeName) {
        this.employeeName = employeeName;
    }

    public String getDeptName() {
        return deptName;
    }

    public void setDeptName(String deptName) {
        this.deptName = deptName;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        this.position = position;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPersonType() {
        return personType;
    }

    public void setPersonType(String personType) {
        this.personType = personType;
    }

    public String getPersonState() {
        return personState;
    }

    public void setPersonState(String personState) {
        this.personState = personState;
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

    public Boolean getDeleted() {
        return deleted;
    }

    public void setDeleted(Boolean deleted) {
        this.deleted = deleted;
    }
}
