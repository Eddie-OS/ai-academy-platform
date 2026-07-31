/**
 * 导入框架 模块（平台层）。
 *
 * <p>职责：6 类导入的通用框架：模板、校验、写入、批次、撤销。依据：需求文档第 14 章、13.8。
 *
 * <p><b>本模块的特有纪律：</b>导入是一期唯一的数据入口（无 SSO、无 HR 集成）。I1～I8 八条规则在框架层实现一次，Handler 不得各自实现。Excel 必须流式读写。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.platform.dataimport;
