// 指标只读聚合。状态取值从 statemachine 转换表推导后作参数传入，禁止在本模块写状态字面量。
dependencies {
    implementation(project(":platform:statemachine"))
}
