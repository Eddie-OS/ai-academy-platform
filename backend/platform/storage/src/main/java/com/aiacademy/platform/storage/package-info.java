/**
 * 附件存储 模块（平台层）。
 *
 * <p>职责：附件上传（含分片）、下载鉴权、逻辑删除。依据：需求文档 16.1.4。
 *
 * <p><b>本模块的特有纪律：</b>FileStorage 是全项目唯一保留接口隔离的地方（STK-2），一期实现为本地磁盘。下载必须鉴权，不得生成永久公开链接（PMI-3）。
 *
 * <p>模块内分四层：controller / service / repository / domain。
 * 结构范本见 {@code com.aiacademy.app.skeleton}（阶段 0 骨架示例，阶段 1 删除）。
 *
 * <p>依赖规则见 CLAUDE.md 第四节 AR-1～AR-7，由 ArchUnit 在 CI 中强制。
 */
package com.aiacademy.platform.storage;
