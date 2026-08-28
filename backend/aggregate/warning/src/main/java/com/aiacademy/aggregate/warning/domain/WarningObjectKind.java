package com.aiacademy.aggregate.warning.domain;

import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;

/**
 * 参与三色灯的三类对象：阈值表用中文类型名，状态机用英文码，表／字段在此收口。
 *
 * <p><b>三类而不是四类。</b>业务改版 V-70 把案例移出了预警范围，需求 7.5 的原文还写着四类
 * （待修，见 docs/文档待修清单.md）。这个枚举是<b>预警范围的唯一定义</b>：
 * 汇总、明细下钻、快照任务都在遍历 {@code values()}，往这里加一个常量就等于把该类对象
 * 整体拉进预警，而 {@code biz_case} 至今仍有 {@code expect_publish_date} 与
 * {@code idx_case_light} 索引 —— 加回来能跑通，只是业务没要。
 */
public enum WarningObjectKind {

    // 退出预警看交付标记「已归档」（与列表 calc_light 筛选、LightFilterSql 示例一致），不是评审状态
    DEMAND(DemandStateMachines.OBJECT_TYPE, "AI需求", "biz_demand",
            "expect_finish_date", "delivery_mark", DemandStateMachines.FIELD_DELIVERY_MARK,
            "demand_name", "owner_no", "outlet"),
    COURSE(CourseStateMachines.OBJECT_TYPE, "课程", "biz_course",
            "expect_publish_date", "main_state", CourseStateMachines.FIELD_MAIN_STATE,
            "course_name", "owner_no", "CAST(NULL AS VARCHAR)"),
    TRAINING_PLAN(TrainingStateMachines.PLAN_OBJECT_TYPE, "培训计划", "biz_training_plan",
            "plan_end_date", "plan_state", TrainingStateMachines.FIELD_PLAN_STATE,
            "plan_name", "owner_no", "CAST(NULL AS VARCHAR)");

    private final String objectType;
    private final String thresholdType;
    private final String table;
    private final String expectFinishColumn;
    private final String stateColumn;
    private final String stateField;
    private final String nameColumn;
    private final String ownerColumn;
    /** 额外退出预警条件列。需求用 outlet；其他类型为 CAST(NULL AS VARCHAR)。 */
    private final String extraScopeColumn;

    WarningObjectKind(String objectType, String thresholdType, String table,
                      String expectFinishColumn, String stateColumn, String stateField,
                      String nameColumn, String ownerColumn, String extraScopeColumn) {
        this.objectType = objectType;
        this.thresholdType = thresholdType;
        this.table = table;
        this.expectFinishColumn = expectFinishColumn;
        this.stateColumn = stateColumn;
        this.stateField = stateField;
        this.nameColumn = nameColumn;
        this.ownerColumn = ownerColumn;
        this.extraScopeColumn = extraScopeColumn;
    }

    public String objectType() {
        return objectType;
    }

    public String thresholdType() {
        return thresholdType;
    }

    public String table() {
        return table;
    }

    public String expectFinishColumn() {
        return expectFinishColumn;
    }

    public String stateColumn() {
        return stateColumn;
    }

    public String stateField() {
        return stateField;
    }

    public String nameColumn() {
        return nameColumn;
    }

    public String ownerColumn() {
        return ownerColumn;
    }

    public String extraScopeColumn() {
        return extraScopeColumn;
    }

    public static WarningObjectKind require(String objectType) {
        for (WarningObjectKind kind : values()) {
            if (kind.objectType.equals(objectType)) {
                return kind;
            }
        }
        throw new IllegalArgumentException("对象类型 " + objectType + " 不参与三色灯计算");
    }

    public static WarningObjectKind ofThresholdType(String thresholdType) {
        for (WarningObjectKind kind : values()) {
            if (kind.thresholdType.equals(thresholdType)) {
                return kind;
            }
        }
        throw new IllegalArgumentException("阈值对象类型未知：" + thresholdType);
    }
}
