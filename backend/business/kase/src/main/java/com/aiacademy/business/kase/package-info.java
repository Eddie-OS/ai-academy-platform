/**
 * 案例 模块（业务层）。
 *
 * <p>职责：案例、审核、互动数据、总结报告。依据：需求文档第 12 章。
 *
 * <p><b>本模块的特有纪律：</b>包名用 kase 而非 case（Java 与 SQL 保留字），表名 biz_case。点赞与评论是用户账号唯一的两个写接口（6.2.5）。组织覆盖统计已整体推二期（N12）。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.business.kase;
