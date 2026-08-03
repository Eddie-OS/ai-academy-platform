package com.aiacademy.business.training.domain;

/**
 * 培训场次列表的一行（需求 11.9 的默认展示列）与日历卡片的数据源（需求 11.8 P4-1）。
 *
 * <p><b>课程名称与讲师姓名不在这里。</b>它们要读 {@code biz_course} 与 {@code biz_lecturer}，
 * 那是另外两个业务模块的表（AR-1），由 app 层批量补齐后放进 VO。
 */
public class TrainingSessionListItem extends TrainingSession {

    private String planNo;

    private String planName;

    /** 实际签到人数（需求 11.4 第 14 项）：签到状态＝已签到的记录数，实时 COUNT。 */
    private Integer actualAttendeeCount;

    /** 是否已导入签到（需求 11.9 的筛选项之一）：本场次有没有任何签到记录。 */
    private Boolean attendanceImported;

    public String getPlanNo() {
        return planNo;
    }

    public void setPlanNo(String planNo) {
        this.planNo = planNo;
    }

    public String getPlanName() {
        return planName;
    }

    public void setPlanName(String planName) {
        this.planName = planName;
    }

    public Integer getActualAttendeeCount() {
        return actualAttendeeCount;
    }

    public void setActualAttendeeCount(Integer actualAttendeeCount) {
        this.actualAttendeeCount = actualAttendeeCount;
    }

    public Boolean getAttendanceImported() {
        return attendanceImported;
    }

    public void setAttendanceImported(Boolean attendanceImported) {
        this.attendanceImported = attendanceImported;
    }
}
