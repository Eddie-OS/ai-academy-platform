plugins {
    java
    alias(libs.plugins.springBoot) apply false
}

// libs 的访问器在子项目求值之前还没注册到子项目上，因此先在根脚本里取一份引用，
// 供下面的 subprojects / configure 块使用。
val catalog = libs

// 仓库路径含非 ASCII 字符时，Gradle 交给测试进程的 classpath 会按系统 ANSI 代码页编码，
// 测试进程随即报 ClassNotFoundException（-Dfile.encoding / -Dsun.jnu.encoding 都无效）。
// classpath 上只有 build 目录（class 输出、resources、各模块 jar），源码目录不在其上，
// 因此把构建输出整体挪到纯 ASCII 路径即可绕开，无需搬迁仓库。
// 生产构建在 Docker 容器内进行（路径本就是 ASCII），不受这里影响。
val asciiPath = Regex("^\\p{ASCII}+$")
val relocatedBuildRoot: File? = File(System.getProperty("user.home"), ".ai-academy-build")
        .takeIf { !asciiPath.matches(rootDir.path) && asciiPath.matches(it.path) }

allprojects {
    group = "com.aiacademy"
    version = "0.1.0-SNAPSHOT"

    relocatedBuildRoot?.let { root ->
        // 末级目录必须仍叫 build：ArchUnit 的 DoNotIncludeTests 是按 build/classes/java/test
        // 这个路径形状识别测试类的，改名会让断言把自身也扫进来。
        val relative = path.removePrefix(":").replace(':', '/')
        layout.buildDirectory.set(File(root, if (relative.isEmpty()) "build" else "$relative/build"))
    }
}

subprojects {
    apply(plugin = "java-library")

    configure<JavaPluginExtension> {
        toolchain {
            languageVersion.set(JavaLanguageVersion.of(17))
        }
    }

    dependencies {
        "implementation"(platform(catalog.spring.boot.bom))
        "testImplementation"(platform(catalog.spring.boot.bom))
        "testImplementation"(catalog.spring.boot.starter.test)
    }

    tasks.withType<JavaCompile>().configureEach {
        options.encoding = "UTF-8"
        // MyBatis 用 record 做查询结果映射时需要编译期保留参数名
        options.compilerArgs.add("-parameters")
    }

    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
        jvmArgs("-Dfile.encoding=UTF-8", "-Dsun.jnu.encoding=UTF-8")
        testLogging {
            events("passed", "skipped", "failed")
            showStandardStreams = true
            exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        }
    }
}

// 15 个领域模块的公共约定。它们没有各自的 build.gradle.kts —— 需要模块专属依赖时再新建。
// 依赖方向由 ArchUnit 的 AR-1～AR-7 强制，不靠 Gradle 依赖图约束：Gradle 层面业务模块本来就
// 不互相声明依赖，ArchUnit 负责防止有人事后加上。
configure(subprojects.filter { it.parent?.name in setOf("platform", "business", "aggregate") }) {
    dependencies {
        "api"(project(":common"))
        "implementation"(catalog.spring.boot.starter)
        "implementation"(catalog.mybatis.plus)
    }
}
