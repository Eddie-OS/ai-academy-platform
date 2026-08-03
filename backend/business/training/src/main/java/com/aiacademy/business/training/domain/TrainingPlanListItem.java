package com.aiacademy.business.training.domain;

/**
 * 培训计划列表的一行（需求 11.8 P4-2 的默认展示列）。
 *
 * <p>继承 {@link TrainingPlan} 拿到全部本体字段，本类只加算出来的两列。
 *
 * <p><b>课程名称不在这里。</b>它要读 {@code biz_course}，而那是课程模块的表（AR-1）。列表页的
 * 课程名由 app 层批量补齐后放进 VO。
 *
 * <p><b>灯色列不在这里。</b>三色灯属于阶段 3 的 {@code aggregate/warning}，本阶段只留出列位置。
 */
public class TrainingPlanListItem extends TrainingPlan {

    /** 培训负责人姓名。<b>负责人不参与判权</b>（纪律 PMI-4）。 */
    private String ownerName;

    /** 实际场次数（需求 11.3 第 10 项）：下属场次的记录数，实时 COUNT。 */
    private Integer actualSessionCount;

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public Integer getActualSessionCount() {
        return actualSessionCount;
    }

    public void setActualSessionCount(Integer actualSessionCount) {
        this.actualSessionCount = actualSessionCount;
    }
}
