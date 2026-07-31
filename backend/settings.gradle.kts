pluginManagement {
    repositories {
        maven { url = uri("https://maven.aliyun.com/repository/gradle-plugin") }
        gradlePluginPortal()
    }
}

plugins {
    // 允许 Gradle 在本机没有 JDK 17 时自动下载一个，见 gradle.properties
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}

dependencyResolutionManagement {
    repositories {
        // 内网部署（BLOCK-03）：如构建机无外网，请改为公司内部 Nexus 镜像地址
        maven { url = uri("https://maven.aliyun.com/repository/public") }
        mavenCentral()
    }
}

rootProject.name = "ai-academy-backend"

// 模块划分严格对应《开发实施文档》4.2.1 的模块清单：
// 平台 7 个、业务 5 个、聚合 3 个，共 15 个领域模块，一个不多一个不少。
// 另有两个工程模块：common（公共基础设施）、app（Web 层 + 启动 + 跨模块编排）。
// 架构图（4.2）中的「Web 层」与「权限拦截器」即 app 模块。

include("common")

include("platform:people")
include("platform:statemachine")
include("platform:audit")
include("platform:dataimport")
include("platform:storage")
include("platform:escalation")
include("platform:dict")

include("business:demand")
include("business:course")
include("business:lecturer")
include("business:training")
include("business:kase")

include("aggregate:metrics")
include("aggregate:warning")
include("aggregate:worklist")

include("app")
