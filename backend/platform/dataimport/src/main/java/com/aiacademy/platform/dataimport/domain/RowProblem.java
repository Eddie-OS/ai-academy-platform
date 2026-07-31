package com.aiacademy.platform.dataimport.domain;

/**
 * 一条校验结果，对应错误报告的一行（规则 I4「行号 + 列名 + 错误原因」）。
 *
 * <p><b>错误与警告必须分开</b>（开发 5.6.3 细节六）：需求 14.3 的「离职负责人」要给出警告清单但
 * 不阻断，14.4 的「姓名与工号不一致」也是警告；而「工号不存在」是错误，要按 I3 阻断整批。
 * 合成一个列表之后，只能二选一——要么离职警告把整批挡下，要么工号不存在被放过去写坏数据。
 *
 * @param rowNo Excel 行号
 * @param column 列名。跨行或整表级问题（如表头不匹配、超行数上限）填空串
 * @param value 出错的原值，错误报告里展示，方便运营对着文件找
 * @param reason 中文原因，直接展示给运营，不放异常堆栈
 */
public record RowProblem(int rowNo, String column, String value, String reason, Severity severity) {

    public enum Severity {
        /** 阻断整批写入（规则 I3）。 */
        ERROR,
        /** 不阻断，只在预览页与错误报告里列出。 */
        WARNING
    }

    public static RowProblem error(int rowNo, String column, String value, String reason) {
        return new RowProblem(rowNo, column, value, reason, Severity.ERROR);
    }

    public static RowProblem warning(int rowNo, String column, String value, String reason) {
        return new RowProblem(rowNo, column, value, reason, Severity.WARNING);
    }

    /** 整表级错误：表头不匹配、行数超限、文件读不出来。行号记 0。 */
    public static RowProblem fileError(String reason) {
        return new RowProblem(0, "", "", reason, Severity.ERROR);
    }
}
