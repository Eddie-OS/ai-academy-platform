package com.aiacademy.platform.audit;

import com.aiacademy.platform.audit.domain.OpType;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标注一个写操作要记入操作审计日志（需求 5.12、开发 5.2.3）。
 *
 * <p>加在<b>服务方法</b>上，不是 Controller 方法上。原因是导入、定时任务这类写操作没有对应的
 * HTTP 入口，而它们同样要留痕。
 *
 * <pre>{@code
 * @AuditLog(objectType = "EMPLOYEE", op = OpType.UPDATE)
 * public void update(long id, EmployeeForm form) { ... }
 * }</pre>
 *
 * <p><b>{@link OpType#UPDATE} 有一个额外要求</b>：所在的 Spring Bean 必须实现
 * {@link AuditSnapshotSource}，切面靠它取变更前后的字段快照做逐字段比较。没实现就会在方法
 * 第一次被调用时抛异常——刻意做成运行期硬失败而不是「跳过 diff 静默写一行」，因为
 * 需求 5.12 要求修改类操作必须记录字段名与变更前后值，静默降级等于让这条要求悄悄失效。
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditLog {

    /** 对象类型码，与状态流转日志的 {@code object_type} 同一套取值。 */
    String objectType();

    OpType op();

    /** 对象ID从哪里取。 */
    ObjectIdSource objectId() default ObjectIdSource.FIRST_ARG;

    enum ObjectIdSource {

        /** 方法第一个参数就是对象ID。修改、删除是这一类。 */
        FIRST_ARG,

        /** 方法返回值是对象ID。新增是这一类——插库之前拿不到自增主键。 */
        RETURN_VALUE,

        /** 不针对单个对象，{@code object_id} 记 null。导入、导出是这一类。 */
        NONE
    }
}
