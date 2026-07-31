/**
 * 催办台账 模块（平台层）。
 *
 * <p>职责：催办台账：记录催办了谁、催什么、什么时候催的。依据：需求文档 13.2、13.5。
 *
 * <p><b>本模块的特有纪律：</b>系统不发送任何消息（规则 MSG1），但完整保留「算出该催谁」的清单生成逻辑（RM1～RM5）。不要定义任何渠道抽象、发送状态机或重试队列。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.platform.escalation;
