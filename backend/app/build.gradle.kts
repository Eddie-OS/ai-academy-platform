plugins {
    alias(libs.plugins.springBoot)
}

// app：Spring Boot 启动类 + Web 层 + 权限拦截器 + 跨模块编排的应用服务（AR-4）。
// 它依赖全部 15 个领域模块，因此 ArchUnit 的架构测试放在本模块（唯一能看到全部包的地方）。

dependencies {
    implementation(project(":common"))

    implementation(project(":platform:people"))
    implementation(project(":platform:statemachine"))
    implementation(project(":platform:audit"))
    implementation(project(":platform:dataimport"))
    implementation(project(":platform:storage"))
    implementation(project(":platform:escalation"))
    implementation(project(":platform:dict"))

    implementation(project(":business:demand"))
    implementation(project(":business:course"))
    implementation(project(":business:lecturer"))
    implementation(project(":business:training"))
    implementation(project(":business:kase"))

    implementation(project(":aggregate:metrics"))
    implementation(project(":aggregate:warning"))
    implementation(project(":aggregate:worklist"))

    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.security)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.mybatis.plus)
    implementation(libs.flyway.core)
    implementation(libs.springdoc.webmvc)
    // 列表导出（开发 5.11.2）：与导入共用 EasyExcel，必须流式写
    implementation(libs.easyexcel)

    runtimeOnly(libs.postgresql)
    runtimeOnly(libs.flyway.postgresql)

    testImplementation(libs.spring.security.test)
    testImplementation(libs.archunit.junit5)

    // 导入测试要现场造 .xlsx。用与生产同一个库写文件，测的才是真实的读写对称性；
    // 手工拼 OOXML 或提交二进制夹具文件都会让「模板改了但夹具没改」变成不可见的失败
    testImplementation(libs.easyexcel)

    // 建库脚本必须在真实 PostgreSQL 上验证：生成列、部分索引、GIN + pg_trgm、TIMESTAMPTZ
    // 这些用到的都是 PostgreSQL 专有能力，H2 一类的内存库跑不了，跑通了也证明不了什么。
    testImplementation(libs.testcontainers.postgresql)
    testImplementation(libs.testcontainers.junit)
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    archiveFileName.set("ai-academy-app.jar")
}

// 部署时生成两个共享账号的口令哈希（规则 SEC5）。用法：
//   ./gradlew :app:printPasswordHash -Ppassword='你的口令'
tasks.register<JavaExec>("printPasswordHash") {
    group = "application"
    description = "生成共享账号口令的 BCrypt 哈希"
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("com.aiacademy.app.security.PasswordHashTool")
    doFirst {
        val password = project.findProperty("password")?.toString()
            ?: throw GradleException("请用 -Ppassword='你的口令' 传入口令")
        args = listOf(password)
    }
}
