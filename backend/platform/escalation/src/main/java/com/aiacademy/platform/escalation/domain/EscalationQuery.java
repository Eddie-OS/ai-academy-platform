package com.aiacademy.platform.escalation.domain;

import java.time.OffsetDateTime;

/**
 * 催办台账列表筛选（需求 8.5、13.2.2）。
 */
public class EscalationQuery {

    private int pageNum = 1;
    private int pageSize = 20;
    private String objectType;
    private Long objectId;
    private String escalateType;
    private String ownerNo;
    private String source;
    private OffsetDateTime escalatedFrom;
    private OffsetDateTime escalatedTo;
    private String keyword;

    public int getPageNum() {
        return pageNum;
    }

    public void setPageNum(int pageNum) {
        this.pageNum = pageNum;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = Math.min(Math.max(pageSize, 1), 200);
    }

    public String getObjectType() {
        return objectType;
    }

    public void setObjectType(String objectType) {
        this.objectType = objectType;
    }

    public Long getObjectId() {
        return objectId;
    }

    public void setObjectId(Long objectId) {
        this.objectId = objectId;
    }

    public String getEscalateType() {
        return escalateType;
    }

    public void setEscalateType(String escalateType) {
        this.escalateType = escalateType;
    }

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public OffsetDateTime getEscalatedFrom() {
        return escalatedFrom;
    }

    public void setEscalatedFrom(OffsetDateTime escalatedFrom) {
        this.escalatedFrom = escalatedFrom;
    }

    public OffsetDateTime getEscalatedTo() {
        return escalatedTo;
    }

    public void setEscalatedTo(OffsetDateTime escalatedTo) {
        this.escalatedTo = escalatedTo;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public int getOffset() {
        return (Math.max(pageNum, 1) - 1) * pageSize;
    }
}
