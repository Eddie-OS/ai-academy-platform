/**
 * 培训运营 模块（业务层）。
 *
 * <p>职责：培训计划、场次、排课校验、参训名单、签到、归档、学员反馈。依据：需求文档第 11 章。
 *
 * <p><b>本模块的特有纪律：</b>计划与场次是两级对象。排课校验只做三项：讲师可上岗、时段冲突、课程处于可发布状态（C08）。报名/候补/请假/补课是二期。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.business.training;
