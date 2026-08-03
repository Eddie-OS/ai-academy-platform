package com.aiacademy.app.web.dto;

import com.aiacademy.business.kase.domain.CaseReport;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 总结报告的出参（需求 12.6，页面 P5-4）。
 *
 * @param generateMode 生成方式。自动生成的报告一经编辑即变为「手动编辑」——读报告的人有权
 *                     知道眼前的数字还是不是系统口径
 * @param createdBy    生成人。共享账号下这里是账号名而不是人名（已被业务接受，AC1）
 */
public record CaseReportVO(Long id, String reportName, LocalDate periodStart, LocalDate periodEnd,
                           String generateMode, String content,
                           OffsetDateTime createdAt, String createdBy,
                           OffsetDateTime updatedAt, String updatedBy) {

    public static CaseReportVO of(CaseReport r) {
        return new CaseReportVO(r.id(), r.reportName(), r.periodStart(), r.periodEnd(),
                r.generateMode(), r.content(), r.createdAt(), r.createdBy(),
                r.updatedAt(), r.updatedBy());
    }
}
