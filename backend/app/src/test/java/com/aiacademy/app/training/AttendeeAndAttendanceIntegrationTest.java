package com.aiacademy.app.training;

import com.aiacademy.business.training.domain.AttendanceForm;
import com.aiacademy.business.training.domain.AttendeeRow;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.business.training.service.SessionAttendeeService;
import com.aiacademy.business.training.service.TrainingSessionService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 参训名单与签到的页面侧维护（阶段 2 C-3 批，需求 11.5）。
 *
 * <p>导入侧（14.4 签到、14.8 名单）在阶段 1 已有测试，这里只测页面上能做的三件事：
 * 手工添加、移除、单条修改签到。
 */
class AttendeeAndAttendanceIntegrationTest extends TrainingTestBase {

    @Autowired
    private SessionAttendeeService attendees;

    @Autowired
    private TrainingSessionService sessions;

    @Test
    @DisplayName("需求 11.5.1：手工添加的加入方式记「运营指派」，姓名与部门取台账当时的值做快照")
    void 手工添加参训人员() {
        long sessionId = 造场次("手工添加");
        String employeeNo = 造人员("张三", "客服中心");

        attendees.addAssigned(sessionId, List.of(employeeNo));

        AttendeeRow row = attendees.rows(sessionId).get(0);
        assertThat(row.employeeNo()).isEqualTo(employeeNo);
        assertThat(row.employeeName()).isEqualTo("张三");
        assertThat(row.deptName()).isEqualTo("客服中心");
        assertThat(row.joinSource()).isEqualTo(TrainingEnums.JOIN_ASSIGNED);
        assertThat(row.attendanceId())
                .describedAs("刚加进名单的人还没有签到记录，页面显示「—」而不是「未签到」")
                .isNull();
    }

    @Test
    @DisplayName("需求 14.8 同理：已在名单上的人重复添加时忽略、不报错")
    void 重复添加忽略不报错() {
        long sessionId = 造场次("重复添加");
        String a = 造人员("甲", "AI中心");
        String b = 造人员("乙", "AI中心");
        attendees.addAssigned(sessionId, List.of(a));

        SessionAttendeeService.AddResult result = attendees.addAssigned(sessionId, List.of(a, b));

        assertThat(result.added()).isEqualTo(1);
        assertThat(result.ignored()).isEqualTo(1);
        assertThat(attendees.rows(sessionId)).hasSize(2);
    }

    @Test
    @DisplayName("工号不在人员台账中要拦下来——名单里留一个查不到的工号，到签到那步就对不上人")
    void 工号必须来自台账() {
        long sessionId = 造场次("台账校验");

        assertThatThrownBy(() -> attendees.addAssigned(sessionId, List.of("E999999")))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("E999999")
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.PARAM_INVALID));
    }

    @Test
    @DisplayName("移除后再加回来不能报唯一键冲突——uk_session_attendee 不带 deleted 条件")
    void 移除后可再次添加() {
        long sessionId = 造场次("移除再加");
        String employeeNo = 造人员("丙", "AI中心");
        attendees.addAssigned(sessionId, List.of(employeeNo));
        long attendeeId = attendees.rows(sessionId).get(0).id();

        attendees.remove(sessionId, attendeeId);
        assertThat(attendees.rows(sessionId)).isEmpty();

        attendees.addAssigned(sessionId, List.of(employeeNo));
        assertThat(attendees.rows(sessionId)).hasSize(1);
    }

    @Test
    @DisplayName("移除名单行不动签到记录：把人从名单里划掉，不代表他那天没来")
    void 移除名单不删签到() {
        long sessionId = 造场次("移除不删签到");
        String employeeNo = 造人员("丁", "AI中心");
        attendees.addAssigned(sessionId, List.of(employeeNo));
        造签到(sessionId, employeeNo, TrainingEnums.ATTEND_PRESENT, "B001");

        attendees.remove(sessionId, attendees.rows(sessionId).get(0).id());

        assertThat(sessions.get(sessionId).getActualAttendeeCount())
                .describedAs("实际参训人数取签到表，不随名单变动")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("名单左连签到：签到未导入的人也要出现在列表里，否则运营看到的人数比实际报名少")
    void 名单与签到合并() {
        long sessionId = 造场次("合并列表");
        String present = 造人员("来了", "AI中心");
        String absent = 造人员("没来", "AI中心");
        String noRecord = 造人员("未导入", "AI中心");
        attendees.addAssigned(sessionId, List.of(present, absent, noRecord));
        造签到(sessionId, present, TrainingEnums.ATTEND_PRESENT, "B001");
        造签到(sessionId, absent, TrainingEnums.ATTEND_ABSENT, "B001");

        List<AttendeeRow> rows = attendees.rows(sessionId);

        assertThat(rows).hasSize(3);
        assertThat(rows).filteredOn(r -> r.attendanceId() == null).hasSize(1);
        assertThat(rows).filteredOn(r -> TrainingEnums.ATTEND_PRESENT.equals(r.attendStatus()))
                .hasSize(1);
    }

    @Test
    @DisplayName("需求 11.5.3：单条修改签到状态，导入批次号保留——改过的行仍属于原批次，撤销那批时一并撤掉")
    void 单条修改签到() {
        long sessionId = 造场次("单条修改");
        String employeeNo = 造人员("戊", "AI中心");
        attendees.addAssigned(sessionId, List.of(employeeNo));
        造签到(sessionId, employeeNo, TrainingEnums.ATTEND_ABSENT, "B007");
        long attendanceId = attendees.rows(sessionId).get(0).attendanceId();

        attendees.updateAttendance(sessionId, attendanceId, new AttendanceForm(
                TrainingEnums.ATTEND_PRESENT, OffsetDateTime.now(), "补签"));

        AttendeeRow row = attendees.rows(sessionId).get(0);
        assertThat(row.attendStatus()).isEqualTo(TrainingEnums.ATTEND_PRESENT);
        assertThat(row.attendRemark()).isEqualTo("补签");
        assertThat(row.attendanceBatch()).isEqualTo("B007");
    }

    @Test
    @DisplayName("签到状态只有两值，一期不区分迟到／早退／请假／缺席（需求议题 24）")
    void 签到状态只有两值() {
        long sessionId = 造场次("状态两值");
        String employeeNo = 造人员("己", "AI中心");
        attendees.addAssigned(sessionId, List.of(employeeNo));
        造签到(sessionId, employeeNo, TrainingEnums.ATTEND_ABSENT, "B001");
        long attendanceId = attendees.rows(sessionId).get(0).attendanceId();

        assertThatThrownBy(() -> attendees.updateAttendance(sessionId, attendanceId,
                new AttendanceForm("迟到", null, null)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.PARAM_INVALID));
    }

    @Test
    @DisplayName("改别的场次的签到记录要 404：路径里的场次与记录必须对得上")
    void 跨场次修改被拒绝() {
        long sessionA = 造场次("场次甲");
        long sessionB = 造场次("场次乙");
        String employeeNo = 造人员("庚", "AI中心");
        attendees.addAssigned(sessionA, List.of(employeeNo));
        造签到(sessionA, employeeNo, TrainingEnums.ATTEND_PRESENT, "B001");
        long attendanceId = attendees.rows(sessionA).get(0).attendanceId();

        assertThatThrownBy(() -> attendees.updateAttendance(sessionB, attendanceId,
                new AttendanceForm(TrainingEnums.ATTEND_ABSENT, null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    private void 造签到(long sessionId, String employeeNo, String status, String batchNo) {
        jdbc.update("""
                INSERT INTO dtl_attendance (session_id, employee_no, employee_name_snapshot,
                                            attend_status, import_batch_no, created_by)
                VALUES (?, ?, '学员', ?, ?, 'OPS')
                """, sessionId, employeeNo, status, batchNo);
    }
}
