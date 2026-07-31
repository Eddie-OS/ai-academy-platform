/**
 * 指标计算 模块（聚合层）。
 *
 * <p>职责：54 个指标公式与总看板数据装配。依据：需求文档第 7 章、第 15 章。
 *
 * <p><b>本模块的特有纪律：</b>实时计算，不建物化视图与预聚合表（U2、C14）。效率指标一律取首次到达目标状态的时间：SQL 用 MIN 而不是 MAX（E1）。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.aggregate.metrics;
