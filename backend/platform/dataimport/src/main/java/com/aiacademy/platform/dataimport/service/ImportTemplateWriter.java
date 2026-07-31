package com.aiacademy.platform.dataimport.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.ExcelWriter;
import com.alibaba.excel.write.metadata.WriteSheet;
import com.aiacademy.platform.dataimport.domain.ImportColumn;
import com.aiacademy.platform.dataimport.domain.ImportTemplateSpec;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * 生成导入模板 .xlsx（需求 13.8.2 区域 A 的六张模板卡）。
 *
 * <p><b>模板是生成的，不是仓库里的静态文件。</b>手工维护 6 个 xlsx 的做法有一个无法回避的失败模式：
 * 改了解析器的列名却忘了改模板文件，运营下载到的仍是旧模板，上传后被自己的系统判为「表头不一致」。
 * 由 {@link ImportTemplateSpec} 生成之后，模板与解析期望同源，这类不一致在结构上不可能出现。
 *
 * <p>两个工作表：第一个是数据表（表头 + 示例行，规则 I2），第二个是填写说明。说明单独放一张表而不是
 * 塞进批注，是因为运营会把模板打印出来对着填。
 */
@Service
public class ImportTemplateWriter {

    private static final String SHEET_DATA = "数据";
    private static final String SHEET_HELP = "填写说明";

    public void write(ImportTemplateSpec spec, OutputStream out) {
        try (ExcelWriter writer = EasyExcel.write(out).build()) {
            WriteSheet data = EasyExcel.writerSheet(0, SHEET_DATA).head(headOf(spec)).build();
            writer.write(List.of(spec.exampleRow()), data);

            WriteSheet help = EasyExcel.writerSheet(1, SHEET_HELP)
                    .head(List.of(List.of("列名"), List.of("必填"), List.of("格式 / 取值")))
                    .build();
            writer.write(helpRows(spec), help);
        }
    }

    private List<List<String>> headOf(ImportTemplateSpec spec) {
        List<List<String>> head = new ArrayList<>();
        for (ImportColumn column : spec.columns()) {
            head.add(List.of(column.header()));
        }
        return head;
    }

    private List<List<String>> helpRows(ImportTemplateSpec spec) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("——", "——", spec.note()));
        for (ImportColumn column : spec.columns()) {
            rows.add(List.of(column.header(), column.required() ? "必填" : "选填", column.format()));
        }
        return rows;
    }
}
