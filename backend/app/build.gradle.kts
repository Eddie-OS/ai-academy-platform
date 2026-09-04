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

    // 嵌入式 PostgreSQL（standalone profile）：内网机器装不了 Docker，也不想装 PG 服务。
    // 这里是 implementation 而不是 testImplementation —— 它要进 bootJar，是生产运行路径的一部分。
    // 二进制约 25MB，换来的是「拷一个 jar 就能跑」，见 application-standalone.yml。
    implementation(platform(libs.zonky.postgres.binaries.bom))
    implementation(libs.zonky.embedded.postgres) {
        /*
         * embedded-postgres 默认把四个平台的二进制全拉进来（windows／linux／darwin／alpine），
         * 每个 14～22MB。只保留实际用得到的两个：
         *
         *   - windows-amd64：部署目标是内网 Windows 台式机（决策 C13）
         *   - linux-amd64：CI 与将来可能的 Linux 主机
         *
         * 顺带修掉一个具体故障：阿里云镜像里没有 alpine 那个构件，
         * 解析时报「Could not find embedded-postgres-binaries-linux-amd64-alpine-15.19.0.jar」。
         * 这两个平台本项目都不部署，拉进来只是让离线依赖包多背 30 多 MB。
         */
        exclude(group = "io.zonky.test.postgres", module = "embedded-postgres-binaries-darwin-amd64")
        exclude(group = "io.zonky.test.postgres", module = "embedded-postgres-binaries-linux-amd64-alpine")
    }
    implementation(libs.zonky.postgres.binaries.windows)
    implementation(libs.zonky.postgres.binaries.linux)

    testImplementation(libs.spring.security.test)
    testImplementation(libs.archunit.junit5)

    // 导入测试要现场造 .xlsx。用与生产同一个库写文件，测的才是真实的读写对称性；
    // 手工拼 OOXML 或提交二进制夹具文件都会让「模板改了但夹具没改」变成不可见的失败
    testImplementation(libs.easyexcel)

    // 建库脚本必须在真实 PostgreSQL 上验证：生成列、部分索引、GIN + pg_trgm、TIMESTAMPTZ、
    // 以及 plpgsql 写的 calc_light。这些都是 PostgreSQL 专有能力，H2 一类的内存库跑不了，
    // 跑通了也证明不了什么。真实 PG 由上面那套嵌入式二进制提供（见 TestPostgres），
    // 与生产同一条交付路径。
    //
    // 这里曾经是 Testcontainers。换掉的原因是部署目标为装不了 Docker 的内网机器，
    // 而「测试要 Docker、生产没有 Docker」意味着测的不是生产那条路。
    // 依赖也一并删掉而不是留着不用：删了之后「不依赖 Docker」由编译器保证——
    // 谁再写一个基于容器的测试会直接编译不过，而不是在内网机器上运行时才发现。
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
