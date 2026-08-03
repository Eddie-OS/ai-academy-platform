package com.aiacademy.app.dataimport;

import com.alibaba.excel.EasyExcel;
import com.aiacademy.platform.dataimport.domain.ImportTemplateSpec;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * 测试用的 .xlsx 造文件工具。
 *
 * <p><b>表头一律取自被测 Handler 自己的模板声明</b>，而不是在测试里另抄一份列名。抄一份的话，
 * 测试会与实现一起漂移：改了列名、两边一起改，测试仍然绿——而运营手里的模板已经对不上了。
 * 列名本身是否符合需求，由 {@link ImportTemplateColumnsTest} 拿需求文档的表格来对账。
 *
 * <p>默认带上示例行，模拟运营「下载模板 → 在示例行下面接着填」的真实用法（规则 I2）。
 */
public final class ImportFile {

    private ImportFile() {
    }

    /** 按模板表头造文件，含 {@code [示例]} 示例行。 */
    public static byte[] of(ImportTemplateSpec spec, List<List<String>> dataRows) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(spec.exampleRow());
        rows.addAll(dataRows);
        return withHeaders(spec.headers(), rows);
    }

    /** 不带示例行。 */
    static byte[] withoutExampleRow(ImportTemplateSpec spec, List<List<String>> dataRows) {
        return withHeaders(spec.headers(), dataRows);
    }

    static byte[] withHeaders(List<String> headers, List<List<String>> rows) {
        List<List<String>> head = headers.stream().map(List::of).toList();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        EasyExcel.write(out).head(head).sheet("数据").doWrite(rows);
        return out.toByteArray();
    }
}
