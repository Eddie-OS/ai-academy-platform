// 人员台账。除公共约定外多两项：
//   platform:dataimport —— 人员导入 Handler 落在本模块，因为「导入的每一行最终写哪些列」
//                          应当由台账自己定义，而不是由导入框架直接拼 SQL
//   platform:audit —— 台账的写操作要留痕（需求 5.12）
dependencies {
    implementation(project(":platform:dataimport"))
    implementation(project(":platform:audit"))
}
