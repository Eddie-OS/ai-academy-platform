package com.aiacademy.platform.people.service;

import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.audit.AuditLog;
import com.aiacademy.platform.audit.AuditSnapshotSource;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.domain.EmployeeForm;
import com.aiacademy.platform.people.repository.EmployeeMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 人员台账的写入口（需求 14.3）。
 *
 * <p>一期<b>没有人员台账页面</b>（阶段 1 只做登录、导入中心、配置中心三个页面），这三个写方法的
 * 调用方是人员导入 Handler（阶段 1C）。它们现在就存在，是因为「导入的每一行最终落到哪张表的哪些列」
 * 应当由台账自己定义，而不是由导入框架直接拼 SQL。
 *
 * <p>三个方法都带 {@link AuditLog}：需求 5.12 要求全部写操作留痕，这张表的每一行都来自导入或
 * 手工维护，改错一个工号会让后续签到导入整批校验失败，追溯需要知道是谁改的。
 */
@Service
public class EmployeeService implements AuditSnapshotSource {

    private final EmployeeMapper mapper;

    public EmployeeService(EmployeeMapper mapper) {
        this.mapper = mapper;
    }

    public Optional<Employee> findByNo(String employeeNo) {
        return Optional.ofNullable(mapper.findByNo(employeeNo));
    }

    @Transactional
    @AuditLog(objectType = "EMPLOYEE", op = OpType.CREATE, objectId = AuditLog.ObjectIdSource.RETURN_VALUE)
    public long create(EmployeeForm form) {
        Employee employee = new Employee();
        employee.setEmployeeNo(form.employeeNo());
        employee.setEmployeeName(form.employeeName());
        employee.setDeptName(form.deptName());
        employee.setPosition(form.position());
        employee.setEmail(form.email());
        employee.setPersonType(form.personType());
        employee.setPersonState(form.personState());
        employee.setImportBatchNo(form.importBatchNo());
        employee.setCreatedBy(currentOperator());
        // created_at / updated_at 交给列默认值 NOW()，少两处「应用时钟与数据库时钟不一致」的机会
        mapper.insert(employee);
        return employee.getId();
    }

    @Transactional
    @AuditLog(objectType = "EMPLOYEE", op = OpType.UPDATE)
    public void update(long id, EmployeeForm form) {
        if (mapper.updateAllFields(id, form, currentOperator()) == 0) {
            throw new NotFoundException("人员不存在或已删除：" + id);
        }
    }

    @Transactional
    @AuditLog(objectType = "EMPLOYEE", op = OpType.DELETE)
    public void delete(long id) {
        if (mapper.logicalDelete(id, currentOperator()) == 0) {
            throw new NotFoundException("人员不存在或已删除：" + id);
        }
    }

    /**
     * 供审计切面做字段级 diff。<b>键是中文字段名</b>，因为它直接落 {@code audit_op_log.field_name}，
     * 而审计日志是给人看的。
     *
     * <p>刻意不含 {@code created_at / updated_by} 这类系统字段：它们每次更新都变，记进审计日志
     * 只会淹没真正的业务变更。
     */
    @Override
    public Map<String, Object> auditSnapshot(long objectId) {
        Employee employee = mapper.selectById(objectId);
        if (employee == null) {
            return Map.of();
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("工号", employee.getEmployeeNo());
        snapshot.put("姓名", employee.getEmployeeName());
        snapshot.put("所属部门", employee.getDeptName());
        snapshot.put("岗位", employee.getPosition());
        snapshot.put("邮箱", employee.getEmail());
        snapshot.put("人员类型", employee.getPersonType());
        snapshot.put("人员状态", employee.getPersonState());
        return snapshot;
    }

    private String currentOperator() {
        return OperatorContext.current().account().name();
    }
}
