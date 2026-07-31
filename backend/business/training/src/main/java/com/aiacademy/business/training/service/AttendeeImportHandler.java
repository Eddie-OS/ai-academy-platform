package com.aiacademy.business.training.service;

import com.aiacademy.business.training.domain.SessionRef;
import com.aiacademy.business.training.repository.TrainingImportMapper;
import com.aiacademy.platform.dataimport.ImportHandler;
import com.aiacademy.platform.dataimport.ImportRowWriter;
import com.aiacademy.platform.dataimport.domain.ImportColumn;
import com.aiacademy.platform.dataimport.domain.ImportPlan;
import com.aiacademy.platform.dataimport.domain.ImportProblems;
import com.aiacademy.platform.dataimport.domain.ImportRow;
import com.aiacademy.platform.dataimport.domain.ImportTemplateSpec;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.domain.PlannedRow;
import com.aiacademy.platform.dataimport.domain.RowOp;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeImportSupport;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 参训名单导入（需求 14.8）。用于开课前预先录入名单，也可以完全不用——签到导入会自动补名单。
 *
 * <p><b>它是六类里唯一「重复行忽略而不报错」的</b>（需求 14.8 末句）：名单是「谁要来听课」的集合，
 * 同一个人出现两次不是数据错误，是运营把几个部门的名单拼在一起的常态。因此重复行走
 * {@link ImportPlan#skip}，既不新增也不报错，预览页把它算进「忽略」。
 *
 * <p>对场次状态没有要求（14.8 A 列只写「须存在」）：名单是开课前录的，那时场次还是「待开课」。
 * 这与签到导入要求「已开课或已结束」正好相反，不要顺手统一。
 */
@Service
public class AttendeeImportHandler implements ImportHandler {

    private static final String TABLE = "dtl_session_attendee";

    private static final String COL_SESSION = "培训场次ID";
    private static final String COL_EMPLOYEE = "学员工号";
    private static final String COL_NAME = "学员姓名";

    /** 需求 11.5.1 的加入方式：通过名单导入进来的算「运营指派」。 */
    private static final String JOIN_BY_OPS = "运营指派";

    private final TrainingImportMapper mapper;
    private final EmployeeImportSupport employees;

    public AttendeeImportHandler(TrainingImportMapper mapper, EmployeeImportSupport employees) {
        this.mapper = mapper;
        this.employees = employees;
    }

    @Override
    public ImportType type() {
        return ImportType.ATTENDEE;
    }

    @Override
    public ImportTemplateSpec template() {
        return new ImportTemplateSpec(ImportType.ATTENDEE, List.of(
                ImportColumn.required(COL_SESSION, 64, "须存在的培训场次ID", "JH2026070001-01"),
                ImportColumn.required(COL_EMPLOYEE, 50, "须在人员台账中存在", "E0001"),
                ImportColumn.optional(COL_NAME, 50, "仅用于核对，以工号为准", "张三")),
                "开课前预先录入名单。同一场次同一工号重复时忽略、不报错。");
    }

    @Override
    public ImportPlan plan(List<ImportRow> rows, ImportProblems problems) {
        Map<String, SessionRef> sessions = loadSessions(rows);
        Map<String, Employee> people = employees.loadByColumn(rows, COL_EMPLOYEE);
        Set<Long> sessionIds = sessions.values().stream().map(SessionRef::id)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> existing = new HashSet<>();
        if (!sessionIds.isEmpty()) {
            for (TrainingImportMapper.AttendanceKey key : mapper.findAttendeeKeys(sessionIds)) {
                existing.add(keyOf(key.sessionId(), key.employeeNo()));
            }
        }

        Set<String> seenInFile = new HashSet<>();
        ImportPlan plan = new ImportPlan();

        for (ImportRow row : rows) {
            String sessionNo = row.text(COL_SESSION);
            String employeeNo = row.text(COL_EMPLOYEE);
            SessionRef session = sessions.get(sessionNo);
            Employee employee = people.get(employeeNo);
            boolean valid = true;

            if (!sessionNo.isEmpty() && session == null) {
                problems.error(row, COL_SESSION, "培训场次不存在");
                valid = false;
            }
            if (!employeeNo.isEmpty() && employee == null) {
                problems.error(row, COL_EMPLOYEE, EmployeeImportSupport.NOT_FOUND);
                valid = false;
            }
            if (!valid) {
                continue;
            }

            String key = keyOf(session.id(), employeeNo);
            if (existing.contains(key) || !seenInFile.add(key)) {
                // 需求 14.8：重复时忽略，不报错
                plan.skip(row);
                continue;
            }
            plan.insert(row, new AttendeeWrite(session.id(), employeeNo,
                    employee.getEmployeeName(), employee.getDeptName()));
        }
        return plan;
    }

    @Override
    public void write(ImportPlan plan, ImportRowWriter writer) {
        for (PlannedRow planned : plan.rows()) {
            if (planned.op() != RowOp.INSERT) {
                continue;
            }
            AttendeeWrite write = planned.payloadAs(AttendeeWrite.class);
            writer.insert(planned.rowNo(), TABLE, () -> mapper.insertAttendee(
                    write.sessionId(), write.employeeNo(), write.employeeName(), write.deptName(),
                    JOIN_BY_OPS, writer.batchNo(), writer.operator()));
        }
    }

    private record AttendeeWrite(long sessionId, String employeeNo, String employeeName, String deptName) {
    }

    private Map<String, SessionRef> loadSessions(List<ImportRow> rows) {
        Set<String> nos = new LinkedHashSet<>();
        for (ImportRow row : rows) {
            String no = row.text(COL_SESSION);
            if (!no.isEmpty()) {
                nos.add(no);
            }
        }
        if (nos.isEmpty()) {
            return Map.of();
        }
        Map<String, SessionRef> byNo = new HashMap<>();
        for (SessionRef session : mapper.findSessionsByNos(nos)) {
            byNo.put(session.sessionNo(), session);
        }
        return byNo;
    }

    private static String keyOf(long sessionId, String employeeNo) {
        return sessionId + "|" + employeeNo;
    }
}
