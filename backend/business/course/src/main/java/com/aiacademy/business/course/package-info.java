/**
 * 课程 模块（业务层）。
 *
 * <p>职责：课程、有效期、材料版本、评审记录、试讲记录、试讲反馈、自检、排期。依据：需求文档第 9 章。
 *
 * <p><b>本模块的特有纪律：</b>每条评审记录绑定提交评审时的材料版本快照（R7）。有效期从首次发布时间起算，过期只打标签、不改主状态、不自动下架（EX）。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.business.course;
