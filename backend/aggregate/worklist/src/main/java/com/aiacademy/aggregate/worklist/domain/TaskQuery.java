package com.aiacademy.aggregate.worklist.domain;

import com.aiacademy.common.api.PageQuery;

/**
 * 任务中心筛选（需求 13.1、AC3）。
 *
 * <p><b>没有「我的任务」页签</b>——共享账号没有个人身份。按负责人查看用 {@link #ownerNo}。
 */
public class TaskQuery extends PageQuery {

    /** 负责人工号。null／空 = 不筛选（全量）。 */
    private String ownerNo;

    private String taskState;

    private String taskType;

    /** true = 只看逾期；false／null = 不按逾期筛。 */
    private Boolean overdueOnly;

    public String getOwnerNo() {
        return ownerNo;
    }

    public void setOwnerNo(String ownerNo) {
        this.ownerNo = ownerNo;
    }

    public String getTaskState() {
        return taskState;
    }

    public void setTaskState(String taskState) {
        this.taskState = taskState;
    }

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }

    public Boolean getOverdueOnly() {
        return overdueOnly;
    }

    public void setOverdueOnly(Boolean overdueOnly) {
        this.overdueOnly = overdueOnly;
    }
}
