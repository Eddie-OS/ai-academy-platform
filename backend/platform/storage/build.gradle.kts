// 附件与本地磁盘存储（TD-7）。一项模块专属依赖：
//   spring-web —— 附件接口（分片上传、流式下载）落在本模块的 controller 包里。
//                 只要 spring-web 而不是 starter-web：Tomcat 与 MVC 自动配置由 app 提供，
//                 平台模块只需要 @RestController、MultipartFile、ResponseEntity 这些注解与类型。
dependencies {
    implementation(libs.spring.web)
}
