/**
 * 人员台账 模块（平台层）。
 *
 * <p>职责：人员台账（讲师与学员）。依据：需求文档 14.3、13.9.4。
 *
 * <p><b>本模块的特有纪律：</b>本模块不是 IAM：没有账号表、角色表、代理关系。两个共享账号的凭据在配置文件里（需求 6.1）。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.platform.people;
