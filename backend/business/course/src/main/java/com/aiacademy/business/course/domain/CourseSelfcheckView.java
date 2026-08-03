package com.aiacademy.business.course.domain;

import java.util.List;

/**
 * 课程自检页签的全部内容（需求 9.4，规则 CK1～CK6）。
 *
 * <p><b>完成度只是一个展示数字。</b>规则 CK3 说明它不阻断提交评审，CK6 说明它不进任何指标、
 * 不参与三色灯判定——「纯自评一旦被考核，填写人会为凑百分比乱勾」。所以这里给出的
 * {@code completedCount / totalCount} 只用于页签标题（如「CheckList 自检 9/14」）与那句提示。
 *
 * @param totalCount 启用中的条目总数，即完成度的分母（CK1、CK5）
 * @param completedCount 已完成的启用中条目数
 */
public record CourseSelfcheckView(
        long courseId,
        int totalCount,
        int completedCount,
        List<CourseSelfcheckItem> items) {

    /** 完成度百分比，保留 1 位小数由前端按设计规范 3.3 做；这里给原始比值。 */
    public boolean allCompleted() {
        return totalCount > 0 && completedCount == totalCount;
    }
}
