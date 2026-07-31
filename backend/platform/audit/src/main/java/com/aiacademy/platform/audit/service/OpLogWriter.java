package com.aiacademy.platform.audit.service;

import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.audit.domain.FieldChange;
import com.aiacademy.platform.audit.domain.OpLog;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.audit.repository.OpLogMapper;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 操作审计日志的写入口（需求 5.12）。
 *
 * <p>正常路径是 {@link com.aiacademy.platform.audit.AuditLog} 注解 + {@link OpLogAspect}，
 * 业务代码不直接调用本类。留出公开方法是给两类切面覆盖不到的场合：导入框架在批次内部逐行写、
 * 定时任务的自动关闭。
 *
 * <p><b>不吞异常</b>：写失败就让事务回滚（开发 5.2.3 坑二）。
 */
@Service
public class OpLogWriter {

    private final OpLogMapper mapper;

    public OpLogWriter(OpLogMapper mapper) {
        this.mapper = mapper;
    }

    /** 非修改类操作：一次操作写一行，不带字段名与前后值。 */
    public void record(String objectType, Long objectId, OpType opType, String remark) {
        mapper.insert(newRow(objectType, objectId, opType, remark));
    }

    /**
     * 修改类操作：<b>每个实际变化的字段写一行</b>。
     *
     * <p>没有任何字段变化时不写行。这不是省事，是防噪音：运营点开编辑页又原样保存的情况很常见，
     * 记一行「什么都没改」会让审计表里塞满无信息的行，真要追溯时反而更难看。
     */
    public void recordFieldChanges(String objectType, Long objectId,
                                   List<FieldChange> changes, String remark) {
        for (FieldChange change : changes) {
            OpLog row = newRow(objectType, objectId, OpType.UPDATE, remark);
            row.setFieldName(change.fieldName());
            row.setOldValue(change.oldValue());
            row.setNewValue(change.newValue());
            mapper.insert(row);
        }
    }

    private OpLog newRow(String objectType, Long objectId, OpType opType, String remark) {
        OperatorContext.Operator operator = OperatorContext.current();

        OpLog row = new OpLog();
        row.setObjectType(objectType);
        row.setObjectId(objectId);
        row.setOpType(opType.dbValue());
        row.setAccountType(operator.account().name());
        row.setOperatorIp(operator.ip());
        row.setOperatedAt(OffsetDateTime.now());
        row.setRemark(remark);
        // operator_no / operator_name 留空：二期一人一账号时才写（开发 5.2.4）
        return row;
    }
}
