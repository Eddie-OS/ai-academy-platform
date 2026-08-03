package com.aiacademy.business.training.repository;

import com.aiacademy.business.training.domain.AttendeeRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 参训名单与签到记录的页面侧读写（需求 11.5）。导入侧的读写在 {@link TrainingImportMapper}。
 *
 * <p>两张表分开写会让详情页出现「名单 30 人、签到 28 条」两个各自分页的列表，运营得自己对
 * 谁没签到。这里统一按名单左连签到取一张表回去。一个场次的名单是几十到几百人量级，不分页。
 */
@Mapper
public interface SessionAttendeeMapper {

    /**
     * 名单 + 签到的合并列表，按工号排序。
     *
     * <p>签到记录的 {@code deleted = FALSE} 条件<b>写在 JOIN 的 ON 里而不是 WHERE 里</b>：
     * 写进 WHERE 会把左连退化成内连，撤销过签到批次的场次会连名单一起消失。
     */
    @Select("""
            SELECT a.id,
                   a.session_id,
                   a.employee_no,
                   a.employee_name_snapshot AS employee_name,
                   a.dept_name_snapshot     AS dept_name,
                   a.join_source,
                   a.import_batch_no,
                   a.created_at,
                   t.id                     AS attendance_id,
                   t.attend_status,
                   t.attend_time,
                   t.remark                 AS attend_remark,
                   t.import_batch_no        AS attendance_batch
              FROM dtl_session_attendee a
              LEFT JOIN dtl_attendance t
                     ON t.session_id = a.session_id
                    AND t.employee_no = a.employee_no
                    AND t.deleted = FALSE
             WHERE a.session_id = #{sessionId} AND a.deleted = FALSE
             ORDER BY a.employee_no
            """)
    List<AttendeeRow> listRows(@Param("sessionId") long sessionId);

    /** 已在名单上的工号（含已逻辑删除的行），决定手工添加时是新增还是恢复。 */
    @Select("""
            SELECT employee_no AS employeeNo, deleted
              FROM dtl_session_attendee
             WHERE session_id = #{sessionId}
            """)
    List<ExistingAttendee> findExisting(@Param("sessionId") long sessionId);

    record ExistingAttendee(String employeeNo, boolean deleted) {
    }

    /**
     * 手工添加参训人员（需求 11.5.1「运营账号手工选择人员添加」）。
     *
     * <p>用 upsert 而不是先查后插：唯一约束 {@code uk_session_attendee} 不带
     * {@code WHERE deleted = FALSE}，删过一次的人再加回来会撞唯一键报 500。冲突时把
     * {@code deleted} 置回 FALSE 并刷新姓名部门快照——重新加入就是重新取一次当时的人员信息。
     */
    @Update("""
            INSERT INTO dtl_session_attendee (session_id, employee_no, employee_name_snapshot,
                                              dept_name_snapshot, join_source, created_by)
            VALUES (#{sessionId}, #{employeeNo}, #{employeeName}, #{deptName}, #{joinSource}, #{operator})
            ON CONFLICT (session_id, employee_no) DO UPDATE
               SET deleted = FALSE,
                   employee_name_snapshot = EXCLUDED.employee_name_snapshot,
                   dept_name_snapshot = EXCLUDED.dept_name_snapshot,
                   updated_at = NOW(),
                   updated_by = #{operator}
            """)
    int upsertAttendee(@Param("sessionId") long sessionId,
                       @Param("employeeNo") String employeeNo,
                       @Param("employeeName") String employeeName,
                       @Param("deptName") String deptName,
                       @Param("joinSource") String joinSource,
                       @Param("operator") String operator);

    /**
     * 从名单移除一个人。
     *
     * <p><b>不连带删签到记录</b>：签到是已经发生的事实，把人从名单里划掉不代表他那天没来。
     * 移除后那条签到记录不再出现在页面上（列表以名单为主表），但它仍在库里参与
     * 「实际参训人数」——这个数取的是签到表，见 {@code TrainingSessionMapper} 的派生列。
     */
    @Update("""
            UPDATE dtl_session_attendee
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND session_id = #{sessionId} AND deleted = FALSE
            """)
    int softDeleteAttendee(@Param("sessionId") long sessionId,
                           @Param("id") long id,
                           @Param("operator") String operator);

    @Select("""
            SELECT id, session_id, employee_no, attend_status
              FROM dtl_attendance
             WHERE id = #{id} AND deleted = FALSE
            """)
    AttendanceRef findAttendance(@Param("id") long id);

    record AttendanceRef(long id, long sessionId, String employeeNo, String attendStatus) {
    }

    /**
     * 单条修改已导入的签到记录（需求 11.5.3 末行）。
     *
     * <p>只动状态、时间、备注三列：姓名与部门是快照，工号与场次是这条记录的身份，
     * 导入批次号保留（理由见 {@code AttendanceForm} 的说明）。
     */
    @Update("""
            UPDATE dtl_attendance
               SET attend_status = #{attendStatus},
                   attend_time = #{attendTime},
                   remark = #{remark},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateAttendance(@Param("id") long id,
                         @Param("attendStatus") String attendStatus,
                         @Param("attendTime") OffsetDateTime attendTime,
                         @Param("remark") String remark,
                         @Param("operator") String operator);
}
