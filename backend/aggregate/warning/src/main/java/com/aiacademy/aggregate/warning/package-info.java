/**
 * 三色灯预警 模块（聚合层）。
 *
 * <p>职责：三色灯实时计算、灯色变化检测、预警明细、有效期到期提示。依据：需求文档 13.4、9.3.1a。
 *
 * <p><b>本模块的特有纪律：</b>灯色不落库，算成 SQL 表达式以便列表页筛选与分页。红灯只看最后状态变更时间（L1），改错别字不能让红灯消失。蓝灯是预警不是健康态。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.aggregate.warning;
