package com.aiacademy.app.schema;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 需求文档字段清单的读取（阶段 2 出口准则 E2-2 四份核对表共用）。
 *
 * <p>数据源是 {@code scripts/schema/extract-field-specs.mjs} 从需求文档<b>机械解析</b>出的 CSV。
 * 机械解析是这套核对的前提：手抄一份字段清单进测试，核的就是「抄的那份与代码一致」，
 * 而需求改了字段却不会有任何提示。
 *
 * <p>抽到这里是因为 A／B／C 三段各自复制了一份完全相同的 CSV 解析，D 段是第四份。
 * 四份副本的问题不在多几十行，而在于说明列的引号处理——那段逻辑一旦有一份改错，
 * 那一章的字段名会整体错位一列，而核对表照样是绿的。
 */
final class RequirementFields {

    private static final String CSV = "/schema/requirement-fields.csv";

    private RequirementFields() {
    }

    /**
     * 一条需求字段。
     *
     * @param section 章节号，如 {@code 12.3}
     * @param seq     表格里的序号。有 {@code 9a} 这类带字母的，因此是字符串
     * @param deleted 需求文档已标注删除（V1.2／V1.3 的削减项）
     */
    record Field(String section, String seq, String name, boolean deleted) {
        String key() {
            return section + "#" + seq;
        }
    }

    /** 取指定章节的全部字段，保持需求表格里的顺序。 */
    static List<Field> of(Set<String> sections) {
        List<Field> fields = new ArrayList<>();
        for (String line : lines()) {
            List<String> cells = splitCsv(line);
            if (cells.size() < 10 || !sections.contains(cells.get(0))) {
                continue;
            }
            fields.add(new Field(cells.get(0), cells.get(2), cells.get(3), "Y".equals(cells.get(9))));
        }
        return fields;
    }

    private static List<String> lines() {
        try (InputStream in = RequirementFields.class.getResourceAsStream(CSV)) {
            if (in == null) {
                throw new IllegalStateException("缺少 " + CSV
                        + "，先跑 scripts/schema/extract-field-specs.mjs");
            }
            return List.of(new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\r?\n"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** 说明列里有逗号（被引号包住），按逗号硬切会把字段名错位。 */
    private static List<String> splitCsv(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (c == ',' && !quoted) {
                cells.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        cells.add(current.toString());
        return cells;
    }
}
