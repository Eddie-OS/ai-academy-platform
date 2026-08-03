package com.aiacademy.aggregate.warning.domain;

import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;

/**
 * 参与三色灯的四类对象：阈值表用中文类型名，状态机用英文码，表／字段在此收口。
 */
public enum WarningObjectKind {

    DEMAND(DemandStateMachines.OBJECT_TYPE, "AI需求", "biz_demand",
            "expect_finish_date", "review_state", DemandStateMachines.FIELD_REVIEW_STATE),
    COURSE(CourseStateMachines.OBJECT_TYPE, "课程", "biz_course",
            "expect_publish_date", "main_state", CourseStateMachines.FIELD_MAIN_STATE),
    TRAINING_PLAN(TrainingStateMachines.PLAN_OBJECT_TYPE, "培训计划", "biz_training_plan",
            "plan_end_date", "plan_state", TrainingStateMachines.FIELD_PLAN_STATE),
    CASE(CaseStateMachines.OBJECT_TYPE, "案例", "biz_case",
            "expect_publish_date", "case_state", CaseStateMachines.FIELD_CASE_STATE);

    private final String objectType;
    private final String thresholdType;
    private final String table;
    private final String expectFinishColumn;
    private final String stateColumn;
    private final String stateField;

    WarningObjectKind(String objectType, String thresholdType, String table,
                      String expectFinishColumn, String stateColumn, String stateField) {
        this.objectType = objectType;
        this.thresholdType = thresholdType;
        this.table = table;
        this.expectFinishColumn = expectFinishColumn;
        this.stateColumn = stateColumn;
        this.stateField = stateField;
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
