// 人员台账。除公共约定外多三项：
//   platform:dataimport —— 人员导入 Handler 落在本模块，因为「导入的每一行最终写哪些列」
//                          应当由台账自己定义，而不是由导入框架直接拼 SQL
//   platform:audit —— 台账的写操作要留痕（需求 5.12）
//   spring-web —— 台账查询接口（controller 包）。只要 spring-web，不要 starter-web：
//                 Tomcat 与 MVC 自动配置由 app 提供，平台模块只需要注解与返回类型
dependencies {
    implementation(project(":platform:dataimport"))
    implementation(project(":platform:audit"))
    implementation(libs.spring.web)
}
