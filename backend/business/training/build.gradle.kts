// 培训域承担三类导入（签到、参训名单、学员反馈），因此依赖导入框架与人员台账。
// 方向是业务→平台，符合 AR-2。
dependencies {
    implementation(project(":platform:dataimport"))
    implementation(project(":platform:people"))
}
