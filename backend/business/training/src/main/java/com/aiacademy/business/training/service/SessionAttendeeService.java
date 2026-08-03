package com.aiacademy.business.training.service;

import com.aiacademy.business.training.domain.AttendanceForm;
import com.aiacademy.business.training.domain.AttendeeRow;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.business.training.repository.SessionAttendeeMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 参训名单与签到的页面侧维护（需求 11.5）。
 *
 * <p>三条录入通道的分工：名单导入（14.8）批量预录、签到导入（14.4）自动补名单、本类做零星调整
 * ——「临时来了两个人」「这个人的签到状态填反了」。<b>本类不提供新增签到的方法</b>，
 * 理由见 {@code AttendanceForm}。
 */
@Service
public class SessionAttendeeService {

    private final SessionAttendeeMapper mapper;
    private final TrainingSessionService sessions;
    private final EmployeeService employees;

    public SessionAttendeeService(SessionAttendeeMapper mapper, TrainingSessionService sessions,
                                  EmployeeService employees) {
        this.mapper = mapper;
        this.sessions = sessions;
        this.employees = employees;
    }

    @Transactional(readOnly = true)
    public List<AttendeeRow> rows(long sessionId) {
        sessions.require(sessionId);
        return mapper.listRows(sessionId);
    }

    /**
     * 手工添加参训人员，加入方式记「运营指派」（需求 11.5.1）。
     *
     * <p>已在名单上的人<b>忽略而不报错</b>，与名单导入的重复行处理一致（需求 14.8 末句）：
     * 运营从人员选择器里一次勾十几个人，其中几个已经在名单上是常态，报错只会让他退回去
     * 一个个核对已经加过谁。
     *
     * @throws BizException 工号不在人员台账中。这个必须报错——名单里出现一个查不到的工号，
     *                      到签到那一步就对不上人
     */
    @Transactional
    public AddResult addAssigned(long sessionId, List<String> employeeNos) {
        sessions.require(sessionId);

        Set<String> wanted = new LinkedHashSet<>();
        for (String no : employeeNos) {
            if (no != null && !no.isBlank()) {
                wanted.add(no.trim());
            }
        }
        if (wanted.isEmpty()) {
            throw new BizException(ErrorCode.PARAM_INVALID, "请选择要添加的参训人员");
        }

        Map<String, Employee> people = employees.findByNos(wanted);
        List<String> unknown = wanted.stream().filter(no -> !people.containsKey(no)).toList();
        if (!unknown.isEmpty()) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "以下工号在人员台账中不存在，请先导入人员：" + String.join("、", unknown));
        }

        Set<String> alive = new HashSet<>();
        for (SessionAttendeeMapper.ExistingAttendee existing : mapper.findExisting(sessionId)) {
            if (!existing.deleted()) {
                alive.add(existing.employeeNo());
            }
        }

        String operator = operator();
        List<String> added = new ArrayList<>();
        int ignored = 0;
        for (String no : wanted) {
            if (alive.contains(no)) {
                ignored++;
                continue;
            }
            Employee employee = people.get(no);
            mapper.upsertAttendee(sessionId, no, employee.getEmployeeName(), employee.getDeptName(),
                    TrainingEnums.JOIN_ASSIGNED, operator);
            added.add(no);
        }
        return new AddResult(added.size(), ignored, added);
    }

    /**
     * @param ignored 已在名单上、本次跳过的条数。前端提示「新增 N 人，已在名单中 M 人」
     */
    public record AddResult(int added, int ignored, List<String> addedEmployeeNos) {
    }

    /** 从名单移除。签到记录不动，理由见 {@code SessionAttendeeMapper#softDeleteAttendee}。 */
    @Transactional
    public void remove(long sessionId, long attendeeId) {
        if (mapper.softDeleteAttendee(sessionId, attendeeId, operator()) == 0) {
            throw new NotFoundException("参训名单记录不存在或已删除：" + attendeeId);
        }
    }

    /** 单条修改已导入的签到记录（需求 11.5.3）。写操作审计日志由 {@code @WriteApi} 那一层记。 */
    @Transactional
    public void updateAttendance(long sessionId, long attendanceId, AttendanceForm form) {
        if (!TrainingEnums.ATTEND_STATUSES.contains(form.attendStatus())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "签到状态只能是：" + String.join(" / ", TrainingEnums.ATTEND_STATUSES));
        }
        SessionAttendeeMapper.AttendanceRef ref = mapper.findAttendance(attendanceId);
        if (ref == null || ref.sessionId() != sessionId) {
            throw new NotFoundException("签到记录不存在或已删除：" + attendanceId);
        }
        mapper.updateAttendance(attendanceId, form.attendStatus(), form.attendTime(),
                blankToNull(form.remark()), operator());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
