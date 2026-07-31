/**
 * 任务中心 模块（聚合层）。
 *
 * <p>职责：任务派生、任务中心、待办清单重算。依据：需求文档 13.1。
 *
 * <p><b>本模块的特有纪律：</b>8 类任务的派生规则与默认截止天数可后台配置（D37）。逾期是派生标记不是状态（D24）。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.aggregate.worklist;
