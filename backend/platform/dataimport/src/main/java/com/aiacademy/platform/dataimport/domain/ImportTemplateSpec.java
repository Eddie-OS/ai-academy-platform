package com.aiacademy.platform.dataimport.domain;

import java.util.List;

/**
 * 一类导入的模板列清单。
 *
 * @param note 模板填写说明的开头几句，写进说明工作表。取需求 14.x 各节的正文提示
 */
public record ImportTemplateSpec(ImportType type, List<ImportColumn> columns, String note) {

    public ImportTemplateSpec {
        columns = List.copyOf(columns);
    }

    public List<String> headers() {
        return columns.stream().map(ImportColumn::header).toList();
    }

    /** 示例行（规则 I2 的第 2 行）。首格带 {@code [示例]} 前缀，解析时据此跳过（开发 5.6.3 细节二）。 */
    public List<String> exampleRow() {
        List<String> values = new java.util.ArrayList<>(columns.stream().map(ImportColumn::example).toList());
        values.set(0, ExampleRow.PREFIX + values.get(0));
        return values;
    }

    /**
     * 示例行的识别方式。
     *
     * <p>需求 I2 只说「自动跳过标记为示例的行」，没有定义标记方式；开发 5.6.3 细节二把它列为坑，
     * 建议用首格前缀，并明确<b>不要硬编码「跳过第 2 行」</b>——运营会在示例行下面直接开始填，
     * 也会把示例行删掉，两种文件都得能导。
     */
    public static final class ExampleRow {

        public static final String PREFIX = "[示例]";

        private ExampleRow() {
        }

        public static boolean isExample(String firstCell) {
            return firstCell != null && firstCell.trim().startsWith(PREFIX);
        }
    }
}
