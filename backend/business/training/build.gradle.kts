// 培训域承担三类导入（签到、参训名单、学员反馈），因此依赖导入框架与人员台账。
// 方向是业务→平台，符合 AR-2。
// 依赖状态机模块有两个用途：取场次状态值的具名常量（导入的前置状态条件 14.4／14.6），
// 以及取计划／场次的初始状态值（列是 NOT NULL，而状态值不写字面量）。
dependencies {
    implementation(project(":platform:dataimport"))
    implementation(project(":platform:people"))
    implementation(project(":platform:statemachine"))

    // 只为编译期可见：EmployeeService 实现了 audit 模块的 AuditSnapshotSource，
    // javac 解析它的方法时要能读到那个接口。本模块自身不写审计日志
    compileOnly(project(":platform:audit"))

    // 表单的字段级校验（计划名称 100 字、面向人群范围 500 字等，需求 11.3／11.4 的约束列）
    implementation(libs.jakarta.validation.api)
}
