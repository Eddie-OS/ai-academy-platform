package com.aiacademy.app.skeleton.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 阶段 0 的骨架示例实体，对应表 {@code sys_skeleton_sample}。
 *
 * <p><b>这是「公共字段模板 + 四层结构」的范本，不是业务对象。</b>阶段 1 建完真实业务表后，
 * 本类与配套的 controller/service/repository、Flyway 脚本 V0_002、前端示例调用一并删除。
 *
 * <p>它演示了四件在阶段 1 会被反复用到的事：
 * <ol>
 *   <li>《开发实施文档》6.1.2 的全部公共字段；</li>
 *   <li>{@code updated_at} 与 {@code last_state_changed_at} <b>严格分离</b>（需求 C5、C6、L1）；</li>
 *   <li>{@code @TableLogic} 逻辑删除（规则 SEC2）；</li>
 *   <li>{@code @Version} 乐观锁（规则 K1）。</li>
 * </ol>
 */
@TableName("sys_skeleton_sample")
public class SkeletonSample {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sampleNo;

    private String sampleName;

    private String sampleState;

    /** 负责人工号。<b>保留字段，但不参与判权</b>（事实 9、纪律 PMI-4）。 */
    private String ownerNo;

    /** 纯日期语义用 DATE，避免「剩余天数」出现 ±1 天偏差（6.1.4）。 */
    private LocalDate expectFinishDate;

    private OffsetDateTime createdAt;

    private String createdBy;

    /** 需求 C6「最后编辑时间」：改错别字只动这个字段。 */
    private OffsetDateTime updatedAt;

    private String updatedBy;

    /** 需求 C5「最后状态变更时间」：红灯停滞判定的唯一依据，只在状态变更时更新。 */
    private OffsetDateTime lastStateChangedAt;

    @Version
    private Integer version;

    @TableLogic
    private Boolean deleted;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSampleNo() {
        return sampleNo;
    }

    public void setSampleNo(String sampleNo) {
        this.sampleNo = sampleNo;
    }

    public String getSampleName() {
        return sampleName;
    }

    public void setSampleName(String sampleName) {
        this.sampleName = sampleName;
    }

    public String getSampleState() {
        return sampleState;
    }

    public void setSampleState(String sampleState) {
        this.sampleState = sampleState;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public LocalDate getExpectFinishDate() {
        return expectFinishDate;
    }

    public void setExpectFinishDate(LocalDate expectFinishDate) {
        this.expectFinishDate = expectFinishDate;
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
