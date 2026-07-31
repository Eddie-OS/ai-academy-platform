// 导入框架（TD-6）。四项模块专属依赖：
//   easyexcel —— 流式读写 xlsx（开发 3.2：禁止 POI 全量 DOM，P4 只给 60 秒）
//   platform:storage —— 导入原文件与错误报告落本地磁盘，全系统只有它接触文件系统
//   platform:audit —— 规则 I6／RB5 要求导入与撤销写操作审计日志
//   spring-web —— 导入中心接口落在本模块的 controller 包里。只要 spring-web 而不是 starter-web：
//                 Tomcat 与 MVC 自动配置由 app 提供
dependencies {
    api(project(":platform:storage"))
    implementation(project(":platform:audit"))
    implementation(libs.easyexcel)
    implementation(libs.spring.boot.starter.jdbc)
    implementation(libs.spring.web)
}
