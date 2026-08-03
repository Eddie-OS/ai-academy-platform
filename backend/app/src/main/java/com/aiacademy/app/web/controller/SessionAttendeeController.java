package com.aiacademy.app.web.controller;

import com.aiacademy.business.training.domain.AttendanceForm;
import com.aiacademy.business.training.domain.AttendeeRow;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.business.training.service.SessionAttendeeService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 场次详情的「参训人员与签到」页签（需求 11.5，页面 P4-4）。
 *
 * <p>一个接口返回名单与签到的合并列表 + 一组汇总数，而不是两个列表各自分页：
 * 运营在这个页签上要回答的问题是「谁没来」，两张表分开摆就得自己对。
 */
@RestController
@RequestMapping("/api/training-sessions/{sessionId}")
public class SessionAttendeeController {

    private final SessionAttendeeService attendees;

    public SessionAttendeeController(SessionAttendeeService attendees) {
        this.attendees = attendees;
    }

    @GetMapping("/attendees")
    public R<AttendeeBoard> attendees(@PathVariable long sessionId) {
        return R.ok(AttendeeBoard.of(attendees.rows(sessionId)));
    }

    /**
     * @param present    已签到人数，也就是场次列表上的「实际参训人数」
     * @param noRecord   名单上还没有签到记录的人数。签到未导入时它等于 {@code total}，
     *                   前端据此提示「本场次尚未导入签到」，而不是显示一列空白
     */
    public record AttendeeBoard(List<AttendeeRow> rows, int total, int present, int absent, int noRecord) {

        static AttendeeBoard of(List<AttendeeRow> rows) {
            int present = 0;
            int absent = 0;
            int noRecord = 0;
            for (AttendeeRow row : rows) {
                if (row.attendanceId() == null) {
                    noRecord++;
                } else if (TrainingEnums.ATTEND_PRESENT.equals(row.attendStatus())) {
                    present++;
                } else {
                    absent++;
                }
            }
            return new AttendeeBoard(rows, rows.size(), present, absent, noRecord);
        }
    }

    /** 手工添加参训人员（需求 11.5.1）。已在名单上的忽略，返回实际新增条数。 */
    @WriteApi
    @PostMapping("/attendees")
    public R<SessionAttendeeService.AddResult> add(@PathVariable long sessionId,
                                                   @Valid @RequestBody AddRequest request) {
        return R.ok(attendees.addAssigned(sessionId, request.employeeNos()));
    }

    public record AddRequest(
            @NotEmpty(message = "请选择要添加的参训人员")
            List<String> employeeNos) {
    }

    @WriteApi
    @DeleteMapping("/attendees/{attendeeId}")
    public R<Void> remove(@PathVariable long sessionId, @PathVariable long attendeeId) {
        attendees.remove(sessionId, attendeeId);
        return R.ok(null);
    }

    /**
     * 单条修改已导入的签到记录（需求 11.5.3）。
     *
     * <p><b>没有对应的新增接口</b>：签到的录入通道只有导入（业务确认项 6）。名单上还没有签到
     * 记录的人，补的办法是重新导一次那个场次。
     */
    @WriteApi
    @PutMapping("/attendances/{attendanceId}")
    public R<Void> updateAttendance(@PathVariable long sessionId, @PathVariable long attendanceId,
                                    @Valid @RequestBody AttendanceForm form) {
        attendees.updateAttendance(sessionId, attendanceId, form);
        return R.ok(null);
    }
}
