package com.aiacademy.platform.people.domain;

/**
 * 人员台账的可写字段（需求 14.3 的导入模板字段）。
 *
 * <p>取值校验放在导入框架与接口层：{@code personType} 只能是「讲师／学员／两者」、
 * {@code personState} 只能是「在职／离职」，这两条同时由表上的 CHECK 约束兜底——
 * 数据库约束是最后一道防线，绕过任何一层代码它都还在。
 *
 * @param employeeNo 工号。新增时必填；更新时不改，它是这张表的业务主键（需求 14.3）
 * @param importBatchNo 导入批次号。手工新增时传 null
 */
public record EmployeeForm(
        String employeeNo,
        String employeeName,
        String deptName,
        String position,
        String email,
        String personType,
        String personState,
        String importBatchNo) {
}
