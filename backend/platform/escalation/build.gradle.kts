// 催办台账与配置（开发 5.8、需求 13.5／13.9.5）。
// 不发送任何消息——本模块只算清单、写台账。
dependencies {
    implementation(project(":platform:audit"))
    implementation(libs.spring.web)
    api(libs.jakarta.validation.api)
}
