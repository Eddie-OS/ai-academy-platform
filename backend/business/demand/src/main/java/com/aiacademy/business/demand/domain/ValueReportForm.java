package com.aiacademy.business.demand.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * 业务价值填报写入（需求 7.8）。
 */
public class ValueReportForm {

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}", message = "填报期间须为年月，如 2026-07")
    private String reportPeriod;

    @Size(max = 500)
    private String efficiencyGain;

    @Size(max = 500)
    private String qualityGain;

    private BigDecimal costSaving;

    /** 可空；有节约值时由 Service 校验必填。 */
    private String costSavingUnit;

    private List<Long> demandIds;

    private List<Long> caseIds;

    @Size(max = 2000)
    private String description;

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
}
