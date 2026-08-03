// 三色灯实时计算。读阈值与状态机终态定义；业务表只通过本模块 repository 的原生 SQL 读取（AR-5）。
dependencies {
    implementation(project(":platform:dict"))
    // dict 的 WarningThresholdService 实现了 audit 的 AuditSnapshotSource，编译期要能解析该接口
    implementation(project(":platform:audit"))
    implementation(project(":platform:statemachine"))
}
