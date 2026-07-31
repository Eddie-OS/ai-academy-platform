package com.aiacademy.platform.dataimport.domain;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 一行待导入数据，按列名取值。
 *
 * <p><b>为什么不用 EasyExcel 的注解映射到 DTO：</b>那样每类导入要维护「DTO 的 @ExcelProperty」
 * 与「模板文件的表头」两份列名，而两者必须逐字相同。用列名取值之后，
 * {@link ImportTemplateSpec} 是唯一来源，模板生成、表头校验、取值三处不可能分叉。
 *
 * <p>行号是 <b>Excel 里看到的行号</b>（表头是第 1 行），因为错误报告要让运营直接跳到那一行
 * （规则 I4），撤销对账也按它记（import_row_snapshot.row_no）。
 */
public final class ImportRow {

    /** 需求 14.4 E 列的格式。Excel 里手填的日期常带秒，两种都收。 */
    private static final DateTimeFormatter[] TIME_PATTERNS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm"),
    };

    private final int rowNo;
    private final Map<String, String> values;

    public ImportRow(int rowNo, Map<String, String> values) {
        this.rowNo = rowNo;
        this.values = new LinkedHashMap<>(values);
    }

    public int rowNo() {
        return rowNo;
    }

    /**
     * 取值。已 trim，缺列或空白返回空串而不是 null。
     *
     * <p>返回空串而不是 null 是刻意的：Excel 里「空单元格」「只有空格」「公式算出空串」三种情况
     * 对运营是同一件事，Handler 里再区分它们只会催生 {@code null} 判断的漏网。
     */
    public String text(String header) {
        String raw = values.get(header);
        return raw == null ? "" : raw.trim();
    }

    public boolean isBlank(String header) {
        return text(header).isEmpty();
    }

    /**
     * 留空时填入列声明的默认值（{@link ImportColumn#requiredWithDefault}）。
     *
     * <p>由框架在必填校验之前调用，因此 Handler 拿到的这一列永远有值——默认值只有一处，
     * 不会出现「模板说明写着默认待培养、Handler 里写成培养中」。
     */
    public void applyDefault(String header, String defaultValue) {
        if (text(header).isEmpty()) {
            values.put(header, defaultValue);
        }
    }

    /** 整数。格式不合法返回 null，由调用方报错——错误文案要带列名，框架给不出。 */
    public Integer intOrNull(String header) {
        String text = text(header);
        if (text.isEmpty()) {
            return null;
        }
        try {
            // Excel 数字列读出来可能是 "5.0"
            return new java.math.BigDecimal(text).intValueExact();
        } catch (ArithmeticException | NumberFormatException e) {
            return null;
        }
    }

    /** 时间。格式不合法返回 null，由调用方报错。 */
    public LocalDateTime dateTimeOrNull(String header) {
        String text = text(header);
        if (text.isEmpty()) {
            return null;
        }
        for (DateTimeFormatter pattern : TIME_PATTERNS) {
            try {
                return LocalDateTime.parse(text, pattern);
            } catch (DateTimeParseException ignored) {
                // 换下一种格式
            }
        }
        return null;
    }

    public Map<String, String> values() {
        return Map.copyOf(values);
    }
}
