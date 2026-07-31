package com.aiacademy.business.training.repository;

import com.aiacademy.business.training.domain.SessionRef;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 培训域三类导入（签到、参训名单、学员反馈）的读写。
 *
 * <p><b>插入语句一律写成 {@code @Select ... RETURNING id}</b>：导入框架要拿新行 ID 记
 * {@code import_row_snapshot}（撤销依赖它），而 MyBatis 的 {@code useGeneratedKeys} 需要一个可写的
 * 参数对象来回填主键。PostgreSQL 的 {@code RETURNING} 让插入本身就是一次查询，比为了取 ID 而放弃
 * 不可变参数更划算。
 */
@Mapper
public interface TrainingImportMapper {

    /**
     * 按场次号批量查场次（签到、参训名单、学员反馈三类导入的关联键都是场次号）。
     *
     * <p>批量而非逐行：见 {@code EmployeeMapper.findByNos} 的说明，这是 P4 达标的前提
     * （开发 5.6.3 细节三）。
     */
    @Select("""
            <script>
            SELECT id, session_no, session_state, training_date, start_time
              FROM biz_training_session
             WHERE deleted = FALSE AND session_no IN
             <foreach collection="sessionNos" item="no" open="(" separator="," close=")">#{no}</foreach>
            </script>
            """)
    List<SessionRef> findSessionsByNos(@Param("sessionNos") Collection<String> sessionNos);

    // -------------------------------------------------------------------------
    // 签到记录 dtl_attendance（需求 14.4）
    // -------------------------------------------------------------------------

    /**
     * 已有签到记录的 {@code 场次ID|工号 → 主键}，用于判定「覆盖更新」还是「新增」（需求 14.4）。
     *
     * <p>按场次整段取而不是按 (场次, 工号) 逐对取：一次导入涉及的场次通常只有几个，
     * 每个场次的签到行数是几十到几百，一次查询就能建好整张 Map。
     */
    @Select("""
            <script>
            SELECT id, session_id, employee_no
              FROM dtl_attendance
             WHERE deleted = FALSE AND session_id IN
             <foreach collection="sessionIds" item="id" open="(" separator="," close=")">#{id}</foreach>
            </script>
            """)
    List<AttendanceKey> findAttendanceKeys(@Param("sessionIds") Collection<Long> sessionIds);

    record AttendanceKey(long id, long sessionId, String employeeNo) {
    }

    @Select("""
            INSERT INTO dtl_attendance (session_id, employee_no, employee_name_snapshot, dept_name_snapshot,
                                        attend_status, attend_time, remark, import_batch_no, created_by)
            VALUES (#{sessionId}, #{employeeNo}, #{employeeName}, #{deptName},
                    #{attendStatus}, #{attendTime}, #{remark}, #{batchNo}, #{operator})
            RETURNING id
            """)
    long insertAttendance(@Param("sessionId") long sessionId,
                          @Param("employeeNo") String employeeNo,
                          @Param("employeeName") String employeeName,
                          @Param("deptName") String deptName,
                          @Param("attendStatus") String attendStatus,
                          @Param("attendTime") OffsetDateTime attendTime,
                          @Param("remark") String remark,
                          @Param("batchNo") String batchNo,
                          @Param("operator") String operator);

    /**
     * 覆盖更新（需求 14.4「同一场次 + 同一工号已有签到记录 → 覆盖更新」）。
     *
     * <p>整行覆盖，不做「非空才更新」：模板里留空的备注就是要清空备注，而不是保留上一次导入的值。
     * 同一个理由见 {@code EmployeeMapper.updateAllFields}。
     */
    @Update("""
            UPDATE dtl_attendance
               SET employee_name_snapshot = #{employeeName},
                   dept_name_snapshot = #{deptName},
                   attend_status = #{attendStatus},
                   attend_time = #{attendTime},
                   remark = #{remark},
                   import_batch_no = #{batchNo},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateAttendance(@Param("id") long id,
                         @Param("employeeName") String employeeName,
                         @Param("deptName") String deptName,
                         @Param("attendStatus") String attendStatus,
                         @Param("attendTime") OffsetDateTime attendTime,
                         @Param("remark") String remark,
                         @Param("batchNo") String batchNo,
                         @Param("operator") String operator);

    // -------------------------------------------------------------------------
    // 参训名单 dtl_session_attendee（需求 11.5.1、14.8）
    // -------------------------------------------------------------------------

    @Select("""
            <script>
            SELECT id, session_id, employee_no
              FROM dtl_session_attendee
             WHERE deleted = FALSE AND session_id IN
             <foreach collection="sessionIds" item="id" open="(" separator="," close=")">#{id}</foreach>
            </script>
            """)
    List<AttendanceKey> findAttendeeKeys(@Param("sessionIds") Collection<Long> sessionIds);

    /**
     * @param joinSource 运营指派 / 随签到导入自动加入（需求 11.5.1）。签到导入自动补名单时填后者，
     *                   撤销签到批次要一并回滚这些行（验收 A8-7）
     */
    @Select("""
            INSERT INTO dtl_session_attendee (session_id, employee_no, employee_name_snapshot,
                                              dept_name_snapshot, join_source, import_batch_no, created_by)
            VALUES (#{sessionId}, #{employeeNo}, #{employeeName}, #{deptName},
                    #{joinSource}, #{batchNo}, #{operator})
            RETURNING id
            """)
    long insertAttendee(@Param("sessionId") long sessionId,
                        @Param("employeeNo") String employeeNo,
                        @Param("employeeName") String employeeName,
                        @Param("deptName") String deptName,
                        @Param("joinSource") String joinSource,
                        @Param("batchNo") String batchNo,
                        @Param("operator") String operator);

    // -------------------------------------------------------------------------
    // 学员反馈 dtl_training_feedback（需求 14.6）
    // -------------------------------------------------------------------------

    /** 各场次已有反馈条数，用于预览提示「本场次已有 N 条反馈，本次将追加 M 条」（规则 FB5）。 */
    @Select("""
            <script>
            SELECT session_id AS id, COUNT(*) AS cnt
              FROM dtl_training_feedback
             WHERE deleted = FALSE AND session_id IN
             <foreach collection="sessionIds" item="id" open="(" separator="," close=")">#{id}</foreach>
             GROUP BY session_id
            </script>
            """)
    List<CountBySession> countFeedbackBySessions(@Param("sessionIds") Collection<Long> sessionIds);

    record CountBySession(long id, long cnt) {
    }

    /**
     * 追加一条学员反馈（规则 I9、FB4：只新增不更新，同一场次多次导入全部追加）。
     *
     * <p><b>{@code submitterNo} 为 null 就是匿名</b>（开发 5.6.3 细节七、出口准则 E1-7）：
     * 不是「照常存工号、只在界面隐藏」。这条做错了没法补救——数据已经落库，谁交的反馈已经泄露。
     */
    @Select("""
            INSERT INTO dtl_training_feedback (session_id, submitter_no, submitter_name, submitter_dept,
                                               score, content, import_batch_no, created_by)
            VALUES (#{sessionId}, #{submitterNo}, #{submitterName}, #{submitterDept},
                    #{score}, #{content}, #{batchNo}, #{operator})
            RETURNING id
            """)
    long insertFeedback(@Param("sessionId") long sessionId,
                        @Param("submitterNo") String submitterNo,
                        @Param("submitterName") String submitterName,
                        @Param("submitterDept") String submitterDept,
                        @Param("score") int score,
                        @Param("content") String content,
                        @Param("batchNo") String batchNo,
                        @Param("operator") String operator);
}
