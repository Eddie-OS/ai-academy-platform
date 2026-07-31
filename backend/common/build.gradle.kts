// common：统一响应、错误码、异常、traceId、账号类型。
// 纪律：本模块不得包含任何业务逻辑，不得依赖任何平台/业务/聚合模块（由 ArchUnit 断言）。

dependencies {
    api(libs.spring.web)
    api(libs.jackson.annotations)
    api(libs.slf4j.api)
    implementation(libs.spring.context)
    compileOnly(libs.jakarta.servlet.api)
    testImplementation(libs.jakarta.servlet.api)
}
