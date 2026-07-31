// 人员台账的增删改要写操作审计日志（需求 5.12），因此依赖 audit 模块的注解与切面。
// 平台模块之间可以依赖（AR-2 约束的是「平台不得依赖业务」这个方向）。
dependencies {
    implementation(project(":platform:audit"))
}
