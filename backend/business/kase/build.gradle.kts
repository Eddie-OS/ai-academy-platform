// 案例域（需求第 12 章）。方向一律是业务→平台，符合 AR-2。
dependencies {
    // 应用领域取作战单元字典，与课程、需求同一口径（需求 13.9.3）
    implementation(project(":platform:dict"))

    // 案例负责人、贡献人、审核人都从人员台账选（需求 12.3 第 5、7、9a 项）
    implementation(project(":platform:people"))

    // 只用它读转换表：INSERT 需要初始状态「待整理」的值，而状态值不写字面量（出口准则 E2-6）。
    // 状态的写入仍然只发生在 StateTransitionService（开发 5.1.4）
    implementation(project(":platform:statemachine"))

    // 只为编译期可见：EmployeeService 实现了 audit 模块的 AuditSnapshotSource，
    // javac 解析它的方法时要能读到那个接口。本模块自身不写审计日志
    compileOnly(project(":platform:audit"))

    implementation(libs.jakarta.validation.api)

    // 点赞与评论的 Controller 必须落在本模块内：ArchUnit 把 WriteAudience.USER_ALLOWED 限定在
    // business.kase 包，理由见 CaseInteractionController 的类注释。
    // 只要 spring-web，不要 starter-web——Web 容器由 app 提供（同 platform:dict）
    implementation(libs.spring.web)
}
