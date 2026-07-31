// 本模块需要一个专属任务：生成《状态机转换表核对清单》交付物。
// 其余依赖仍由根脚本的公共约定提供。

tasks.register<JavaExec>("writeChecklist") {
    group = "documentation"
    description = "生成《状态机转换表核对清单》到 docs/ 下（阶段 1 交付物）"
    mainClass.set("com.aiacademy.platform.statemachine.tool.StateMachineChecklistTool")
    classpath = sourceSets["main"].runtimeClasspath
    // 输出路径含中文，且清单正文全中文，必须显式指定 UTF-8，否则 Windows 默认 GBK 会写出乱码
    jvmArgs("-Dfile.encoding=UTF-8", "-Dsun.jnu.encoding=UTF-8")
    args(rootProject.projectDir.resolve("../docs/状态机转换表核对清单.md").absolutePath)
}
