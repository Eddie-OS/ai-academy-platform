package com.aiacademy.business.lecturer.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 一条培养计划与培养记录。只记录运营录入的结果，不是培养引擎。
 */
public class CultivationRecord {

    private Long id;
    private Long lecturerId;
    private String planText;
    private LocalDate plannedFrom;
    private LocalDate plannedTo;
    private String cultivationTypes;
    private String recordText;
    private LocalDate actualFrom;
    private LocalDate actualTo;
    private String planState;
    private String evaluation;
    private String remark;
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

    public Long getLecturerId() {
        return lecturerId;
    }

    public void setLecturerId(Long lecturerId) {
        this.lecturerId = lecturerId;
    }

    public String getPlanText() {
        return planText;
    }

    public void setPlanText(String planText) {
        this.planText = planText;
    }

    public LocalDate getPlannedFrom() {
        return plannedFrom;
    }

    public void setPlannedFrom(LocalDate plannedFrom) {
        this.plannedFrom = plannedFrom;
    }

    public LocalDate getPlannedTo() {
        return plannedTo;
    }

    public void setPlannedTo(LocalDate plannedTo) {
        this.plannedTo = plannedTo;
    }

    public String getCultivationTypes() {
        return cultivationTypes;
    }

    public void setCultivationTypes(String cultivationTypes) {
        this.cultivationTypes = cultivationTypes;
    }

    public String getRecordText() {
        return recordText;
    }

    public void setRecordText(String recordText) {
        this.recordText = recordText;
    }

    public LocalDate getActualFrom() {
        return actualFrom;
    }

    public void setActualFrom(LocalDate actualFrom) {
        this.actualFrom = actualFrom;
    }

    public LocalDate getActualTo() {
        return actualTo;
    }

    public void setActualTo(LocalDate actualTo) {
        this.actualTo = actualTo;
    }

    public String getPlanState() {
        return planState;
    }

    public void setPlanState(String planState) {
        this.planState = planState;
    }

    public String getEvaluation() {
        return evaluation;
    }

    public void setEvaluation(String evaluation) {
        this.evaluation = evaluation;
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
}
