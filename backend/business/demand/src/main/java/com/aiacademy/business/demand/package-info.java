/**
 * AI需求 模块（业务层）。
 *
 * <p>职责：AI需求、两条分流出口、业务验收、需求↔课程关联。依据：需求文档第 8 章。
 *
 * <p><b>本模块的特有纪律：</b>分流出口由 3 类减为 2 类（删除「已有工具可直接复用」）。业务验收由运营录入结论，验收人姓名是一个填写字段（C06）。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.business.demand;
