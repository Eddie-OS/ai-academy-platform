// 操作审计日志用注解 + 切面实现（开发 5.2.3），避免 100 多个写接口逐个手写日志代码。
// 这是全项目唯一需要 AOP 的地方，因此依赖只加在本模块，不进根脚本的公共约定。
dependencies {
    implementation(libs.spring.boot.starter.aop)
}
