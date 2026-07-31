/**
 * 状态机引擎 模块（平台层）。
 *
 * <p>职责：15 个状态机的定义与转换执行引擎。依据：需求文档第 5 章全章。
 *
 * <p><b>本模块的特有纪律：</b>转换表是数据不是代码，每一条都必须来自需求第 5 章的表格，不得自行增补。非法转换硬阻断在服务层（C3），不能只靠前端隐藏按钮。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.platform.statemachine;
