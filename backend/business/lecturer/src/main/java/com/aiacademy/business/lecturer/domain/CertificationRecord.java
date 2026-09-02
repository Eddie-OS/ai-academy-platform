package com.aiacademy.business.lecturer.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** 一条认证记录。不驱动认证流程。 */
public class CertificationRecord {

    private Long id;
    private Long lecturerId;
    private String certBatch;
    private String lecturerLevel;
    private String certState;
    private String reviewers;
    private String opinion;
    private LocalDate passedOn;
    private LocalDate validFrom;
    private LocalDate validTo;
    private OffsetDateTime createdAt;
    private String createdBy;
    private OffsetDateTime updatedAt;
    private String updatedBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getLecturerId() { return lecturerId; }
    public void setLecturerId(Long lecturerId) { this.lecturerId = lecturerId; }
    public String getCertBatch() { return certBatch; }
    public void setCertBatch(String certBatch) { this.certBatch = certBatch; }
    public String getLecturerLevel() { return lecturerLevel; }
    public void setLecturerLevel(String lecturerLevel) { this.lecturerLevel = lecturerLevel; }
    public String getCertState() { return certState; }
    public void setCertState(String certState) { this.certState = certState; }
    public String getReviewers() { return reviewers; }
    public void setReviewers(String reviewers) { this.reviewers = reviewers; }
    public String getOpinion() { return opinion; }
    public void setOpinion(String opinion) { this.opinion = opinion; }
    public LocalDate getPassedOn() { return passedOn; }
    public void setPassedOn(LocalDate passedOn) { this.passedOn = passedOn; }
    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate validFrom) { this.validFrom = validFrom; }
    public LocalDate getValidTo() { return validTo; }
    public void setValidTo(LocalDate validTo) { this.validTo = validTo; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
