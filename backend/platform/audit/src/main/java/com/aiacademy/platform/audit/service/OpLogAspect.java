package com.aiacademy.platform.audit.service;

import com.aiacademy.platform.audit.AuditLog;
import com.aiacademy.platform.audit.AuditSnapshotSource;
import com.aiacademy.platform.audit.domain.FieldChange;
import com.aiacademy.platform.audit.domain.OpType;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 把 {@link AuditLog} 注解变成审计日志行（开发 5.2.3）。
 *
 * <p><b>切面只在方法正常返回后写日志</b>，方法抛异常时不写：失败的操作没有改动任何数据，
 * 记一行「修改」会让审计日志与真实数据不一致。
 *
 * <p><b>切面不捕获自己的异常</b>（坑二）。写日志失败必须让业务事务回滚——需求 16.1.3 把审计留痕
 * 列为一期优先级最高的非功能要求，一个「改成功了但没留痕」的结果比「操作失败请重试」严重得多。
 */
@Aspect
@Component
public class OpLogAspect {

    private final OpLogWriter writer;

    public OpLogAspect(OpLogWriter writer) {
        this.writer = writer;
    }

    @Around("@annotation(auditLog)")
    public Object around(ProceedingJoinPoint point, AuditLog auditLog) throws Throwable {
        Long objectId = objectIdFromArgs(point, auditLog);

        if (auditLog.op() == OpType.UPDATE) {
            if (objectId == null) {
                throw new IllegalStateException(signature(point)
                        + " 是修改类操作，必须能取到对象ID才能做字段级 diff，"
                        + "不允许 @AuditLog(objectId = NONE)");
            }
            AuditSnapshotSource source = snapshotSource(point, auditLog);
            Map<String, Object> before = source.auditSnapshot(objectId);

            Object result = point.proceed();

            List<FieldChange> changes = FieldChange.diff(before, source.auditSnapshot(objectId));
            writer.recordFieldChanges(auditLog.objectType(), objectId, changes, null);
            return result;
        }

        Object result = point.proceed();
        Long id = auditLog.objectId() == AuditLog.ObjectIdSource.RETURN_VALUE
                ? asId(result, point, "返回值")
                : objectId;
        writer.record(auditLog.objectType(), id, auditLog.op(), null);
        return result;
    }

    private Long objectIdFromArgs(ProceedingJoinPoint point, AuditLog auditLog) {
        if (auditLog.objectId() != AuditLog.ObjectIdSource.FIRST_ARG) {
            return null;
        }
        Object[] args = point.getArgs();
        if (args.length == 0) {
            throw new IllegalStateException(signature(point)
                    + " 声明了 @AuditLog(objectId = FIRST_ARG) 但没有参数");
        }
        return asId(args[0], point, "第一个参数");
    }

    private Long asId(Object value, ProceedingJoinPoint point, String where) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        throw new IllegalStateException(signature(point) + " 的" + where
                + "不是数字，无法作为审计日志的对象ID。改用 @AuditLog(objectId = NONE) "
                + "或调整方法签名让对象ID排在首位");
    }

    /**
     * {@code op = UPDATE} 时必须能取到字段快照。
     *
     * <p>这里<b>抛异常而不是退化成「只记一行不记字段」</b>：静默降级会让「修改类操作必须记录
     * 字段名与变更前后值」这条需求在某个服务上悄悄失效，而审计日志的缺陷通常要到追责时才被发现，
     * 那时已经无法补录。
     */
    private AuditSnapshotSource snapshotSource(ProceedingJoinPoint point, AuditLog auditLog) {
        if (point.getTarget() instanceof AuditSnapshotSource source) {
            return source;
        }
        throw new IllegalStateException(signature(point) + " 标了 @AuditLog(op = UPDATE, objectType = "
                + auditLog.objectType() + ")，但所在类没有实现 AuditSnapshotSource，"
                + "切面无法做字段级 diff（需求 5.12、开发 5.2.3）");
    }

    private String signature(ProceedingJoinPoint point) {
        return point.getSignature().toShortString();
    }
}
