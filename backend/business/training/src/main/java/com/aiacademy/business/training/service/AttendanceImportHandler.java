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
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 签到导入（需求 14.4）。<b>一期使用频率最高的导入功能</b>，也是 P4／E1-4 的压测对象。
 *
 * <p>一行最多写两张表：签到记录，以及在参训名单里找不到这个人时自动补的一条名单记录
 * （需求 14.4、验收 A8-6）。两次写都走 {@code writer}，因此撤销时两张表一起回滚（验收 A8-7）。
 *
 * <p>需求 14.4 的「导入后自动动作」（更新场次实际签到人数、更新授课记录实际参训人数、完成签到导入
 * 任务）<b>不在本阶段</b>：场次与授课记录的实际人数是实时统计值，任务派生属阶段 3（开发 8.5 硬约束
 * 「不要实现任何业务对象的 CRUD」）。这里只负责把签到数据准确落库——那三项动作的数据源就是它。
 */
@Service
public class AttendanceImportHandler implements ImportHandler {

    private static final String TABLE_ATTENDANCE = "dtl_attendance";
    private static final String TABLE_ATTENDEE = "dtl_session_attendee";

    private static final String COL_SESSION = "培训场次ID";
    private static final String COL_EMPLOYEE = "学员工号";
    private static final String COL_NAME = "学员姓名";
    private static final String COL_STATUS = "签到状态";
    private static final String COL_TIME = "签到时间";
    private static final String COL_REMARK = "备注";

    private static final Set<String> ATTEND_STATUS = Set.of("已签到", "未签到");

    /**
     * 需求 14.4 A 列：须存在且场次状态为「已开课」或「已结束」。
     *
     * <p>状态值取状态机模块的常量，本文件里不出现状态字符串（出口准则 E2-6）。
     * {@code STATE_HINT} 是给运营看的那半句话，由同一份常量拼出来——否则改了状态名，
     * 校验会跟着变而模板说明不会，运营照着一句过时的说明填表。
     */
    private static final Set<String> ALLOWED_SESSION_STATES =
            Set.of(TrainingStateMachines.SESSION_OPENED, TrainingStateMachines.SESSION_FINISHED);

    private static final String STATE_HINT = TrainingStateMachines.SESSION_OPENED
            + "或" + TrainingStateMachines.SESSION_FINISHED;

    /** 需求 11.5.1 的加入方式取值。 */
    private static final String JOIN_BY_ATTENDANCE = "随签到导入自动加入";

    private final TrainingImportMapper mapper;
    private final EmployeeImportSupport employees;

    public AttendanceImportHandler(TrainingImportMapper mapper, EmployeeImportSupport employees) {
        this.mapper = mapper;
        this.employees = employees;
    }

    @Override
    public ImportType type() {
        return ImportType.ATTENDANCE;
    }

    @Override
    public ImportTemplateSpec template() {
        return new ImportTemplateSpec(ImportType.ATTENDANCE, List.of(
                ImportColumn.required(COL_SESSION, 64, "如 JH2026070001-01，须为" + STATE_HINT + "的场次",
                        "JH2026070001-01"),
                ImportColumn.required(COL_EMPLOYEE, 50, "≤50 字符，须在人员台账中存在", "E0001"),
                ImportColumn.optional(COL_NAME, 50, "仅用于人工核对，以工号为准", "张三"),
                ImportColumn.required(COL_STATUS, "已签到 / 未签到，仅两值", "已签到"),
                ImportColumn.optional(COL_TIME, "yyyy-MM-dd HH:mm，留空取场次开始时间", "2026-08-01 09:00"),
                ImportColumn.optional(COL_REMARK, 200, "≤200 字", "临时调休，线上参加")),
                "同一场次同一工号重复导入按覆盖更新处理；学员不在参训名单中时自动补入名单。"
                        + "允许一个文件包含多个场次。");
    }

    @Override
    public ImportPlan plan(List<ImportRow> rows, ImportProblems problems) {
        Map<String, SessionRef> sessions = loadSessions(rows);
        Map<String, Employee> people = employees.loadByColumn(rows, COL_EMPLOYEE);
        Set<Long> sessionIds = sessions.values().stream().map(SessionRef::id)
                .collect(java.util.stream.Collectors.toSet());
        Map<String, Long> existingAttendance = keyMap(sessionIds.isEmpty()
                ? List.of() : mapper.findAttendanceKeys(sessionIds));
        Map<String, Long> existingAttendee = keyMap(sessionIds.isEmpty()
                ? List.of() : mapper.findAttendeeKeys(sessionIds));

        Set<String> seenInFile = new HashSet<>();
        ImportPlan plan = new ImportPlan();

        for (ImportRow row : rows) {
            String sessionNo = row.text(COL_SESSION);
            String employeeNo = row.text(COL_EMPLOYEE);
            String status = row.text(COL_STATUS);

            SessionRef session = sessions.get(sessionNo);
            Employee employee = people.get(employeeNo);
            boolean valid = true;

            if (!sessionNo.isEmpty() && session == null) {
                problems.error(row, COL_SESSION, "培训场次不存在");
                valid = false;
            } else if (session != null && !ALLOWED_SESSION_STATES.contains(session.sessionState())) {
                problems.error(row, COL_SESSION,
                        "场次当前状态为「%s」，只有%s的场次可以导入签到"
                                .formatted(session.sessionState(), STATE_HINT));
                valid = false;
            }
            if (!employeeNo.isEmpty() && employee == null) {
                problems.error(row, COL_EMPLOYEE, EmployeeImportSupport.NOT_FOUND);
                valid = false;
            }
            if (!status.isEmpty() && !ATTEND_STATUS.contains(status)) {
                problems.error(row, COL_STATUS, "只能填「已签到」或「未签到」");
                valid = false;
            }
            OffsetDateTime attendTime = null;
            if (!row.isBlank(COL_TIME)) {
                java.time.LocalDateTime parsed = row.dateTimeOrNull(COL_TIME);
                if (parsed == null) {
                    problems.error(row, COL_TIME, "时间格式不正确，应为 yyyy-MM-dd HH:mm");
                    valid = false;
                } else {
                    attendTime = parsed.atZone(java.time.ZoneId.systemDefault()).toOffsetDateTime();
                }
            }
            if (session != null && employee != null && !seenInFile.add(keyOf(session.id(), employeeNo))) {
                problems.error(row, COL_EMPLOYEE, "同一场次的同一工号在文件里出现了多次");
                valid = false;
            }
            if (!valid) {
                continue;
            }

            // 需求 14.4 C 列：姓名仅用于人工核对，以工号为准，不一致时警告但不阻断
            String fileName = row.text(COL_NAME);
            if (!fileName.isEmpty() && !fileName.equals(employee.getEmployeeName())) {
                problems.warning(row, COL_NAME,
                        "与台账中的姓名「%s」不一致，将以工号为准".formatted(employee.getEmployeeName()));
            }
            // 签到时间留空时取场次开始时间（需求 14.4 E 列）
            OffsetDateTime effectiveTime = attendTime != null ? attendTime : session.startAt();

            String key = keyOf(session.id(), employeeNo);
            AttendanceWrite write = new AttendanceWrite(session.id(), employeeNo,
                    employee.getEmployeeName(), employee.getDeptName(), status, effectiveTime,
                    blankToNull(row.text(COL_REMARK)),
                    // 名单里没有这个人时自动补入（需求 14.4、验收 A8-6）
                    !existingAttendee.containsKey(key));

            Long existingId = existingAttendance.get(key);
            if (existingId == null) {
                plan.insert(row, write);
            } else {
                plan.update(row, existingId, write);
            }
        }
        return plan;
    }

    @Override
    public void write(ImportPlan plan, ImportRowWriter writer) {
        for (PlannedRow planned : plan.rows()) {
            AttendanceWrite write = planned.payloadAs(AttendanceWrite.class);

            if (write.autoJoinAttendee()) {
                writer.insert(planned.rowNo(), TABLE_ATTENDEE, () -> mapper.insertAttendee(
                        write.sessionId(), write.employeeNo(), write.employeeName(), write.deptName(),
                        JOIN_BY_ATTENDANCE, writer.batchNo(), writer.operator()));
            }
            if (planned.op() == RowOp.INSERT) {
                writer.insert(planned.rowNo(), TABLE_ATTENDANCE, () -> mapper.insertAttendance(
                        write.sessionId(), write.employeeNo(), write.employeeName(), write.deptName(),
                        write.attendStatus(), write.attendTime(), write.remark(),
                        writer.batchNo(), writer.operator()));
            } else if (planned.op() == RowOp.UPDATE) {
                writer.update(planned.rowNo(), TABLE_ATTENDANCE, planned.targetId(),
                        () -> mapper.updateAttendance(planned.targetId(), write.employeeName(),
                                write.deptName(), write.attendStatus(), write.attendTime(), write.remark(),
                                writer.batchNo(), writer.operator()));
            }
        }
    }

    /**
     * @param autoJoinAttendee 该学员不在参训名单中，需自动补一条名单记录
     */
    private record AttendanceWrite(long sessionId, String employeeNo, String employeeName, String deptName,
                                   String attendStatus, OffsetDateTime attendTime, String remark,
                                   boolean autoJoinAttendee) {
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

    private static Map<String, Long> keyMap(List<TrainingImportMapper.AttendanceKey> keys) {
        Map<String, Long> map = new HashMap<>();
        for (TrainingImportMapper.AttendanceKey key : keys) {
            map.put(keyOf(key.sessionId(), key.employeeNo()), key.id());
        }
        return map;
    }

    private static String keyOf(long sessionId, String employeeNo) {
        return sessionId + "|" + employeeNo;
    }

    private static String blankToNull(String value) {
        return value.isEmpty() ? null : value;
    }
}
