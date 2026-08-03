package com.aiacademy.business.kase.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 总结报告 {@code dtl_case_report}（需求 12.6，页面 P5-4）。
 *
 * <p>字段按需求 V1.3 的 12.6 字段表落地。阶段 1 建表时 12.6 只有页面描述，字段是推导的
 * （待修清单 S-6），{@code V2_004} 已按字段表重建。
 *
 * @param generateMode 生成方式。系统自动生成后一经编辑即转为「手动编辑」——让读报告的人知道
 *                     眼前的数字还是不是系统口径
 * @param createdBy    生成人。共享账号下这里是账号名而不是人名（已被业务接受，AC1）
 */
public record CaseReport(long id, String reportName, LocalDate periodStart, LocalDate periodEnd,
                         String generateMode, String content,
                         OffsetDateTime createdAt, String createdBy,
                         OffsetDateTime updatedAt, String updatedBy) {
}
