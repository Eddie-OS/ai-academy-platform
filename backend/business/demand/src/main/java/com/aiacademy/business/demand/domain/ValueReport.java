package com.aiacademy.business.demand.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 业务价值人工填报（需求 7.8、15.6）。
 */
public class ValueReport {

    private Long id;
    private String reportPeriod;
    private String efficiencyGain;
    private String qualityGain;
    private BigDecimal costSaving;
    private String costSavingUnit;
    private List<Long> demandIds;
    private List<Long> caseIds;
    private String description;
    private OffsetDateTime createdAt;
    private String createdBy;
    private OffsetDateTime updatedAt;
    private String updatedBy;
    private Integer version;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getReportPeriod() {
        return reportPeriod;
    }

    public void setReportPeriod(String reportPeriod) {
        this.reportPeriod = reportPeriod;
    }

    public String getEfficiencyGain() {
        return efficiencyGain;
    }

    public void setEfficiencyGain(String efficiencyGain) {
        this.efficiencyGain = efficiencyGain;
    }

    public String getQualityGain() {
        return qualityGain;
    }

    public void setQualityGain(String qualityGain) {
        this.qualityGain = qualityGain;
    }

    public BigDecimal getCostSaving() {
        return costSaving;
    }

    public void setCostSaving(BigDecimal costSaving) {
        this.costSaving = costSaving;
    }

    public String getCostSavingUnit() {
        return costSavingUnit;
    }

    public void setCostSavingUnit(String costSavingUnit) {
        this.costSavingUnit = costSavingUnit;
    }

    public List<Long> getDemandIds() {
        return demandIds;
    }

    public void setDemandIds(List<Long> demandIds) {
        this.demandIds = demandIds;
    }

    public List<Long> getCaseIds() {
        return caseIds;
    }

    public void setCaseIds(List<Long> caseIds) {
        this.caseIds = caseIds;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
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
