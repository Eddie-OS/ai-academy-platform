// 字典与配置中心（需求 13.9）。除公共约定外多两项：
//   platform:audit —— 13.9.1 要求「全部配置项均写操作审计日志，记录修改前值与修改后值」
//   spring-web —— 配置中心的四组接口（controller 包）。只要 spring-web，不要 starter-web
dependencies {
    implementation(project(":platform:audit"))
    implementation(project(":platform:escalation"))
    implementation(libs.spring.web)
    // 表单上的 @NotBlank / @Min 等注解。校验的执行者（Hibernate Validator）由 app 提供，
    // 平台模块只需要注解本身
    api(libs.jakarta.validation.api)
}
