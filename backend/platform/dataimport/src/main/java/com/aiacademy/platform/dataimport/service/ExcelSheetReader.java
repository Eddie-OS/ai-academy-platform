package com.aiacademy.platform.dataimport.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.event.AnalysisEventListener;
import com.alibaba.excel.exception.ExcelAnalysisStopException;
import com.aiacademy.platform.dataimport.domain.ImportColumn;
import com.aiacademy.platform.dataimport.domain.ImportProblems;
import com.aiacademy.platform.dataimport.domain.ImportRow;
import com.aiacademy.platform.dataimport.domain.ImportTemplateSpec;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把上传的 .xlsx 解析成 {@link ImportRow}，并做与业务无关的三项校验：表头、行数上限、必填与字数。
 *
 * <p><b>必须流式读</b>（开发 3.2、5.6.3 细节三）：EasyExcel 走 SAX，内存占用与行数基本无关；
 * 换成 POI 的 {@code XSSFWorkbook} 会把整个工作簿建成 DOM，5000 行的文件在 64G 单机上要和
 * PostgreSQL 抢内存，而 P4 只给 60 秒。
 *
 * <p>本类只认列名、不认列序：{@link ImportTemplateSpec} 是模板与解析器的共同来源，因此表头一致就
 * 一定对得上；表头不一致时报错也比按列序静默错位好——错位不会报错，只会把姓名写进岗位列。
 */
@Service
public class ExcelSheetReader {

    /** 规则 I1：单次导入上限 5000 行。 */
    public static final int MAX_DATA_ROWS = 5000;

    /**
     * 解析。表头不匹配或超行数上限时返回空列表，并在 {@code problems} 里留一条整表级错误。
     */
    public List<ImportRow> read(InputStream in, ImportTemplateSpec spec, ImportProblems problems) {
        List<String> headers = spec.headers();
        List<ImportRow> rows = new ArrayList<>();
        RowCollector collector = new RowCollector(headers, rows, problems);

        try {
            EasyExcel.read(in)
                    // headRowNumber(0)：不让 EasyExcel 自己吃掉表头。表头要拿来与模板声明逐字对账，
                    // 而示例行的跳过规则（规则 I2）也只有我们自己知道
                    .headRowNumber(0)
                    .registerReadListener(collector)
                    .sheet(0)
                    .doRead();
        } catch (ExcelAnalysisStopException stopped) {
            // 主动中止：表头不匹配或超过行数上限，problems 里已有原因
            return List.of();
        } catch (RuntimeException e) {
            problems.fileError("文件无法解析，请确认是 .xlsx 格式且未损坏：" + e.getMessage());
            return List.of();
        }

        if (problems.hasErrors() && rows.isEmpty()) {
            return List.of();
        }
        validateRequiredAndLength(spec, rows, problems);
        return rows;
    }

    /**
     * 必填与字数上限的统一判定。
     *
     * <p>放在框架而不是各 Handler 里，是为了让 6 类导入的错误文案一致——运营看到的「工号：必填项
     * 不能为空」与「学员工号：必填项不能为空」应该是同一句话。同时也少了 6 份漏判的机会。
     */
    private void validateRequiredAndLength(ImportTemplateSpec spec, List<ImportRow> rows,
                                           ImportProblems problems) {
        for (ImportRow row : rows) {
            for (ImportColumn column : spec.columns()) {
                if (column.defaultValue() != null) {
                    // 必须在必填判定之前：需求 14.5 F 列既标 M 又规定「留空按待培养处理」（A11-6）
                    row.applyDefault(column.header(), column.defaultValue());
                }
                String value = row.text(column.header());
                if (column.required() && value.isEmpty()) {
                    problems.error(row, column.header(), "必填项不能为空");
                } else if (column.maxLength() > 0 && value.length() > column.maxLength()) {
                    problems.error(row, column.header(),
                            "超出 %d 字上限（当前 %d 字）".formatted(column.maxLength(), value.length()));
                }
            }
        }
    }

    private static final class RowCollector extends AnalysisEventListener<Map<Integer, String>> {

        private final List<String> headers;
        private final List<ImportRow> rows;
        private final ImportProblems problems;
        private boolean headerChecked;

        private RowCollector(List<String> headers, List<ImportRow> rows, ImportProblems problems) {
            this.headers = headers;
            this.rows = rows;
            this.problems = problems;
        }

        @Override
        public void invoke(Map<Integer, String> cells, AnalysisContext context) {
            int rowIndex = context.readRowHolder().getRowIndex();

            if (!headerChecked) {
                headerChecked = true;
                checkHeader(cells);
                return;
            }
            if (isBlankRow(cells)) {
                // Excel 文件尾部常有一堆带格式的空行，它们不是数据行，也不该算进 5000 行上限
                return;
            }
            if (ImportTemplateSpec.ExampleRow.isExample(cells.get(0))) {
                // 规则 I2 的示例行。按首格前缀识别而不是按行号——运营会删掉示例行，也会在它下面
                // 直接开始填（开发 5.6.3 细节二）
                return;
            }
            if (rows.size() >= MAX_DATA_ROWS) {
                problems.fileError("单次导入上限 %d 行（规则 I1），请拆分文件后重新导入".formatted(MAX_DATA_ROWS));
                // 立即中止解析：文件可能有几十万行，读完只是为了报同一条错
                throw new ExcelAnalysisStopException();
            }

            Map<String, String> byHeader = new LinkedHashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                byHeader.put(headers.get(i), cells.get(i));
            }
            // rowIndex 从 0 起，Excel 里看到的行号从 1 起。错误报告要让运营直接跳到那一行（规则 I4）
            rows.add(new ImportRow(rowIndex + 1, byHeader));
        }

        private void checkHeader(Map<Integer, String> cells) {
            List<String> actual = new ArrayList<>();
            for (int i = 0; i < headers.size(); i++) {
                String cell = cells.get(i);
                actual.add(cell == null ? "" : cell.trim());
            }
            if (!actual.equals(headers)) {
                problems.fileError("表头与模板不一致。期望：%s；实际：%s。请下载最新模板重新填写"
                        .formatted(String.join(" | ", headers), String.join(" | ", actual)));
                throw new ExcelAnalysisStopException();
            }
        }

        private boolean isBlankRow(Map<Integer, String> cells) {
            return cells.values().stream().allMatch(v -> v == null || v.trim().isEmpty());
        }

        @Override
        public void doAfterAllAnalysed(AnalysisContext context) {
            // 无需收尾：行已逐行收进 rows
        }
    }
}
