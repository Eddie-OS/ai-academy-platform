/**
 * 讲师 模块（业务层）。
 *
 * <p>职责：讲师、入池、培养状态、授课记录、学员评价。依据：需求文档第 10 章。
 *
 * <p><b>本模块的特有纪律：</b>培养状态（待培养/培养中/可上岗）是自由选择的枚举，不是状态机，且不写状态流转日志（TS1、TS2）。等级 L0–L4 与上岗状态已按业务裁决落地；能力评估模型仍是二期。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.business.lecturer;
