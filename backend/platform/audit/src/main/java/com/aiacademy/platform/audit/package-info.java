/**
 * 双日志 模块（平台层）。
 *
 * <p>职责：状态流转日志与操作审计日志。依据：需求文档 5.11、5.12、13.7。
 *
 * <p><b>本模块的特有纪律：</b>状态流转日志是 9 个效率指标与红灯预警的唯一数据源，优先级高于任何业务功能。讲师培养状态与课程过期标记不写流转日志（TS2、EX）。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.platform.audit;
