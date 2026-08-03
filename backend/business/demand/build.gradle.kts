dependencies {
    // 所属领域取作战单元字典而不是写枚举（需求 13.9.3：作战单元允许后续扩展）
    implementation(project(":platform:dict"))

    // 提出人部门是「随提出人自动带出」的快照文本（需求 8.3.1 第 5 项），要查人员台账
    implementation(project(":platform:people"))

    // 只为编译期可见：EmployeeService 实现了 audit 模块的 AuditSnapshotSource，
    // javac 解析它的方法时要能读到那个接口。本模块自身不写审计日志
    compileOnly(project(":platform:audit"))

    // 只用它读转换表：INSERT 需要初始评审状态的值，而状态值不写字面量。
    // 状态的写入仍然只发生在 StateTransitionService（开发 5.1.4）
    implementation(project(":platform:statemachine"))
}
