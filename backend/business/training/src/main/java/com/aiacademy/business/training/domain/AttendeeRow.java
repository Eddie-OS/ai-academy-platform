package com.aiacademy.business.training.domain;

import java.time.OffsetDateTime;

/**
 * 场次详情「参训人员与签到」页签的一行（需求 11.5.1 + 11.5.2 合并）。
 *
 * <p><b>以参训名单为主表、签到记录左连</b>，而不是反过来：名单里有人没有签到记录是常态
 * （签到还没导入，或那次导入漏了这个人），这些人必须出现在页面上——否则运营看到的是
 * 「一场培训只有 3 个人」，而实际报名的是 30 个。签到导入会自动补名单（需求 11.5.1 末句），
 * 所以名单一定是签到记录的超集。
 *
 * @param id              名单记录ID，删除名单行用它
 * @param joinSource      加入方式：运营指派 / 随签到导入自动加入
 * @param attendanceId    签到记录ID。<b>为 null 表示这个人还没有签到记录</b>，前端显示「—」而不是「未签到」
 * @param attendStatus    已签到 / 未签到
 * @param importBatchNo   名单行的导入批次；手工添加的为 null
 * @param attendanceBatch 签到记录的导入批次，按批次撤销时用
 */
public record AttendeeRow(
        long id,
        long sessionId,
        String employeeNo,
        String employeeName,
        String deptName,
        String joinSource,
        String importBatchNo,
        OffsetDateTime createdAt,

        Long attendanceId,
        String attendStatus,
        OffsetDateTime attendTime,
        String attendRemark,
        String attendanceBatch) {
}
