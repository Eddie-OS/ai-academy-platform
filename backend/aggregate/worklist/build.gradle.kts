// 任务中心只读查询。任务写入（派生／关闭）在 app 的 EffectHandler，遵守 AR-3。
dependencies {
    implementation(project(":platform:statemachine"))
}
