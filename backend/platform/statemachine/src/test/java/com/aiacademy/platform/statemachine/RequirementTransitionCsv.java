package com.aiacademy.platform.statemachine;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * 读取 {@code scripts/statemachine/extract-transitions.mjs} 从需求文档第 5 章解析出的转换表。
 *
 * <p><b>这份 CSV 是测试的独立数据源。</b>引擎的转换表在 Java 里手写，测试拿 CSV 逐行驱动它，
 * 两边只要有一处不一致就红灯。如果让引擎也读这份 CSV，测试就退化成「断言恒真」——
 * 这正是《开发实施文档》8.3.3 纪律 PT-3 点名的风险。
 *
 * <p>需求文档改动后必须重跑解析脚本。
 */
record RequirementTransitionCsv(
        String machine,
        String objectType,
        String stateField,
        String from,
        String actionLabel,
        String to,
        String effects,
        int sourceLine) {

    private static final String RESOURCE = "/statemachine/requirement-transitions.csv";

    /** 起始状态为空表示需求表格里的「（新建）」或「（空）」，引擎里对应 from = null。 */
    String fromOrNull() {
        return from.isEmpty() ? null : from;
    }

    /** 供测试报告显示，出错时能直接定位到需求文档的行。 */
    @Override
    public String toString() {
        return "%s：%s + %s → %s（需求文档第 %d 行）"
                .formatted(machine, from.isEmpty() ? "（新建/空）" : from, actionLabel, to, sourceLine);
    }

    static List<RequirementTransitionCsv> loadAll() {
        List<String> lines = readLines();
        List<RequirementTransitionCsv> rows = new ArrayList<>();
        for (int i = 1; i < lines.size(); i++) { // 跳过表头
            if (lines.get(i).isBlank()) {
                continue;
            }
            List<String> cells = splitCsvLine(lines.get(i));
            rows.add(new RequirementTransitionCsv(
                    cells.get(0), cells.get(1), cells.get(2), cells.get(3),
                    cells.get(4), cells.get(5), cells.get(6), Integer.parseInt(cells.get(7))));
        }
        if (rows.isEmpty()) {
            throw new IllegalStateException(
                    "未解析到任何需求转换。先执行：node scripts/statemachine/extract-transitions.mjs");
        }
        return rows;
    }

    private static List<String> readLines() {
        try (InputStream in = RequirementTransitionCsv.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("缺少 " + RESOURCE
                        + "，先执行：node scripts/statemachine/extract-transitions.mjs");
            }
            return List.of(new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\r?\n"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** 副作用列含中文分号与逗号，必须按 CSV 引号规则解析，不能简单 split(","). */
    private static List<String> splitCsvLine(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (quoted) {
                if (c != '"') {
                    cell.append(c);
                } else if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else {
                    quoted = false;
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == ',') {
                cells.add(cell.toString());
                cell.setLength(0);
            } else {
                cell.append(c);
            }
        }
        cells.add(cell.toString());
        return cells;
    }
}
