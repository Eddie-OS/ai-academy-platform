// 课程域承担试讲反馈导入（需求 14.7），关联键是试讲记录ID。
dependencies {
    implementation(project(":platform:dataimport"))
    implementation(project(":platform:people"))

    // 所属领域与课程分类查字典而不是写枚举（需求 13.9.3：作战单元允许后续扩展）
    implementation(project(":platform:dict"))

    // 只用它读转换表：INSERT 需要初始主状态的值，而状态值不写字面量。
    // 状态的写入仍然只发生在 StateTransitionService（开发 5.1.4）
    implementation(project(":platform:statemachine"))

    // 课程材料与版本快照要在 sys_attachment_ref 上登记引用（规则 R7、F5）：漏登记的后果不是
    // 报错，是课件被孤儿清理物理删除
    implementation(project(":platform:storage"))
}
