// 讲师导入（需求 14.5）与讲师池维护（需求 10.3）：工号校验查人员台账，
// 擅长领域校验查作战单元字典。方向是业务→平台，符合 AR-2。
//
// 不依赖 platform:statemachine —— 讲师的培养状态与在池状态都不是状态机（规则 TS1、C10），
// 本模块没有任何状态列要取初始值。这条「缺席的依赖」本身就是那条纪律的证据。
dependencies {
    implementation(project(":platform:dataimport"))
    implementation(project(":platform:people"))
    implementation(project(":platform:dict"))

    // 只为编译期可见：EmployeeService 实现了 audit 模块的 AuditSnapshotSource，
    // javac 解析它的方法时要能读到那个接口。本模块自身不写审计日志
    compileOnly(project(":platform:audit"))

    // 表单的字段级校验（姓名 50 字、授课方向 500 字等，需求 10.3 的约束列）
    implementation(libs.jakarta.validation.api)
}
