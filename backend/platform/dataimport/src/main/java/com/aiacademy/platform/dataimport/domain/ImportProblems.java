package com.aiacademy.platform.dataimport.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * 校验结果收集器。一次导入一个实例，非线程安全（导入是单线程的，规则 I3 要求先全量校验再写入）。
 *
 * <p>不在遇到第一个错误时抛异常，是规则 I4 的直接要求：错误报告要把<b>所有</b>错误行列出来，
 * 运营才能一次改完重导。逐个报错会让 5000 行的文件改 5000 遍。
 */
public final class ImportProblems {

    private final List<RowProblem> problems = new ArrayList<>();

    public void error(ImportRow row, String column, String reason) {
        problems.add(RowProblem.error(row.rowNo(), column, row.text(column), reason));
    }

    public void error(ImportRow row, String column, String value, String reason) {
        problems.add(RowProblem.error(row.rowNo(), column, value, reason));
    }

    public void warning(ImportRow row, String column, String reason) {
        problems.add(RowProblem.warning(row.rowNo(), column, row.text(column), reason));
    }

    public void fileError(String reason) {
        problems.add(RowProblem.fileError(reason));
    }

    public void add(RowProblem problem) {
        problems.add(problem);
    }

    /** 存在任一错误行即整批不写入（规则 I3）。警告不算。 */
    public boolean hasErrors() {
        return problems.stream().anyMatch(p -> p.severity() == RowProblem.Severity.ERROR);
    }

    public List<RowProblem> errors() {
        return problems.stream().filter(p -> p.severity() == RowProblem.Severity.ERROR).toList();
    }

    public List<RowProblem> warnings() {
        return problems.stream().filter(p -> p.severity() == RowProblem.Severity.WARNING).toList();
    }

    public List<RowProblem> all() {
        return List.copyOf(problems);
    }
}
