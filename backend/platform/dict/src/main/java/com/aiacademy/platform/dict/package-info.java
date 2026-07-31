/**
 * 字典与配置 模块（平台层）。
 *
 * <p>职责：字典、三色灯阈值、任务派生规则、自检 CheckList 题库。依据：需求文档 13.9。
 *
 * <p><b>本模块的特有纪律：</b>枚举与字典由本模块下发给前端（7.5），前端不硬编码任何状态值。CheckList 14 条若不初始化，课程自检页签会静默为空。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.platform.dict;
