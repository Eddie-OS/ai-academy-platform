package com.aiacademy.platform.dataimport.domain;

/**
 * 导入模板的一列（需求 14.3～14.8 各节的列表格）。
 *
 * <p><b>这个声明是模板文件与解析器的唯一共同来源</b>：模板 xlsx 由它生成，上传文件的表头也由它
 * 校验。手写模板文件的做法会让两者悄悄分叉——运营下载了旧模板、系统按新表头校验，报出的错误是
 * 「表头不匹配」，而运营手里的文件确实是系统给的。
 *
 * <p>列名逐字取自需求，包含「培训场次ID」这类不符合命名习惯的写法。不要顺手改成「场次ID」：
 * 运营手里的模板表头必须与需求正文一致，否则验收时对不上。
 *
 * @param header 列名，必须与需求表格的「列名」逐字相同
 * @param required 必填（需求表格的 M / O）。M 列留空即错误行，由框架统一判定
 * @param maxLength 字数上限，0 表示不限。由框架统一判定，因此 Handler 里不该再出现长度校验
 * @param defaultValue 留空时自动填入的值，null 表示没有默认值
 * @param format 格式／取值，写进模板的填写说明工作表
 * @param example 示例值，写进模板第 2 行（规则 I2）
 */
public record ImportColumn(String header, boolean required, int maxLength,
                           String defaultValue, String format, String example) {

    public static ImportColumn required(String header, String format, String example) {
        return new ImportColumn(header, true, 0, null, format, example);
    }

    public static ImportColumn required(String header, int maxLength, String format, String example) {
        return new ImportColumn(header, true, maxLength, null, format, example);
    }

    /**
     * 需求把列标成 M（必填），但同时规定「留空按某个值处理」——需求 14.5 F 列的培养状态就是这样
     * （验收 A11-6）。
     *
     * <p>这两句话不矛盾：这一列在业务上必须有值，只是留空不算运营填错，而是同意用默认值。
     * 因此框架在必填校验<b>之前</b>把默认值填进去，Handler 拿到的永远是有值的列。
     * 若按普通必填处理，A11-6 就成了空话；若按选填处理，需求的 M 标记又对不上（而
     * {@code ImportTemplateColumnsTest} 拿需求文档逐列对账，会直接红灯）。
     */
    public static ImportColumn requiredWithDefault(String header, String defaultValue,
                                                   String format, String example) {
        return new ImportColumn(header, true, 0, defaultValue, format, example);
    }

    public static ImportColumn optional(String header, String format, String example) {
        return new ImportColumn(header, false, 0, null, format, example);
    }

    public static ImportColumn optional(String header, int maxLength, String format, String example) {
        return new ImportColumn(header, false, maxLength, null, format, example);
    }
}
