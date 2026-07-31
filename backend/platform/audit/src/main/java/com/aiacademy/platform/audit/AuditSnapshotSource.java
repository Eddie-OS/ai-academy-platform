package com.aiacademy.platform.audit;

import java.util.Map;

/**
 * 提供对象的字段快照，供审计切面做字段级 diff。带 {@code @AuditLog(op = UPDATE)} 的服务必须实现它。
 *
 * <p><b>为什么要这个接口，而不是让切面序列化整个 DTO：</b>需求 5.12 要求记录变更前后值，
 * 但整体序列化会把附件内容、长文本、以及 SEC4 禁止的凭据一起写进日志（开发 5.2.3 坑一）。
 * 由服务自己列出「哪些字段该进审计」，是唯一能杜绝这件事的做法。
 *
 * <p>返回的键就是落库的 {@code field_name}，因此<b>用中文业务字段名</b>（如「姓名」「所属部门」），
 * 不要用 Java 属性名——审计日志是给人看的。
 */
public interface AuditSnapshotSource {

    /**
     * 对象当前的字段快照。对象不存在时返回空 Map。
     *
     * <p>用 {@link java.util.LinkedHashMap} 保持字段顺序，日志里多字段修改的行序才稳定。
     */
    Map<String, Object> auditSnapshot(long objectId);
}
