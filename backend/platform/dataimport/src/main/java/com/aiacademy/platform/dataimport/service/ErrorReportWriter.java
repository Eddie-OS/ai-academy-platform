package com.aiacademy.platform.dataimport.service;

import com.alibaba.excel.EasyExcel;
import com.aiacademy.platform.dataimport.domain.RowProblem;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * 生成错误报告 .xlsx（规则 I4：「行号 + 列名 + 错误原因」）。
 *
 * <p>比规则要求多一列「错误值」：运营拿着报告去改文件，光有行号列名还得再回去看一眼填的是什么，
 * 把原值一并列出来可以少一次来回（需求 13.8.3 第 3 步的错误行表格也是这四列）。
 *
 * <p>警告行一并写进去。校验通过但有警告的批次也会生成报告——需求 14.3 的「离职负责人警告清单」
 * 只在界面上弹一下运营记不住，能下载才用得上。
 */
@Service
public class ErrorReportWriter {

    private static final List<List<String>> HEAD = List.of(
            List.of("行号"), List.of("列名"), List.of("错误值"), List.of("级别"), List.of("错误原因"));

    /**
     * 生成报告字节。
     *
     * <p>整个报告先在内存里成形再落盘：条数上限是 5000 行 × 每行最多几条问题，量级在 MB，
     * 与「附件不许读进内存」的 200MB 场景不是一回事。
     */
    public byte[] write(List<RowProblem> problems) {
        List<List<String>> rows = new ArrayList<>();
        for (RowProblem problem : problems) {
            rows.add(List.of(
                    problem.rowNo() == 0 ? "整表" : String.valueOf(problem.rowNo()),
                    problem.column(),
                    problem.value() == null ? "" : problem.value(),
                    problem.severity() == RowProblem.Severity.ERROR ? "错误" : "警告",
                    problem.reason()));
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        EasyExcel.write(out).head(HEAD).sheet("错误报告").doWrite(rows);
        return out.toByteArray();
    }
}
