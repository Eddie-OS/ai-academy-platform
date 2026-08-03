package com.aiacademy.business.kase.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 总结报告的生成与编辑表单（需求 12.6）。
 *
 * <p>生成与编辑共用一个表单，区别只在 {@code content}：生成时留空，由系统按统计区间填四个段落；
 * 编辑时带着改过的正文回来，生成方式随之转为「手动编辑」。
 *
 * <p><b>不含生成方式。</b>它由走哪条路径决定，不是可填字段——让运营能手选就等于允许一份
 * 从没被编辑过的报告被标成「手动编辑」。
 */
public record CaseReportForm(
        @NotBlank(message = "请填写报告名称")
        @Size(max = 100, message = "报告名称不超过 100 字")
        String reportName,

        @NotNull(message = "请选择统计区间的开始日期")
        LocalDate periodStart,

        @NotNull(message = "请选择统计区间的结束日期")
        LocalDate periodEnd,

        String content) {
}
