package com.aiacademy.business.lecturer.domain;

import java.math.BigDecimal;

/**
 * 讲师池列表的一行（需求 10.7 的默认展示列 + 可选列）。
 *
 * <p>继承 {@link Lecturer} 拿到全部本体字段，本类只加三项实时算出来的统计
 * （需求 10.3 第 11–13 项）。三项都不落库，理由见 {@link Lecturer} 的类注释。
 *
 * <p><b>平均评分只统计正式培训的学员反馈，试讲反馈不计入</b>（规则 R10）——
 * 两者的分值语义不同，1 分的试讲反馈与 5 分的正式反馈平均成 3.0 是需求 15.3 结尾专门警告过的错误。
 */
public class LecturerListItem extends Lecturer {

    /** 累计授课次数：该讲师已结束（含已归档）的培训场次数。 */
    private Integer teachingCount;

    /** 累计学员人次：上述场次的已签到人数之和。 */
    private Integer attendeeCount;

    /** 平均评分，1.0–5.0 保留 1 位小数；没有任何反馈时为 null，前端显示「—」。 */
    private BigDecimal avgScore;

    public Integer getTeachingCount() {
        return teachingCount;
    }

    public void setTeachingCount(Integer teachingCount) {
        this.teachingCount = teachingCount;
    }

    public Integer getAttendeeCount() {
        return attendeeCount;
    }

    public void setAttendeeCount(Integer attendeeCount) {
        this.attendeeCount = attendeeCount;
    }

    public BigDecimal getAvgScore() {
        return avgScore;
    }

    public void setAvgScore(BigDecimal avgScore) {
        this.avgScore = avgScore;
    }
}
