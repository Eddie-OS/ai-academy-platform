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
            int sourceLine = Integer.parseInt(cells.get(7));
            if (sourceLine <= 0) {
                /*
                 * 行号是解析脚本写进去的需求文档行号，手工添加的行填不出来，只能写 0。
                 * 这里硬失败而不是跳过：这份 CSV 的全部价值在于它是「独立的、机器抽取的」
                 * 事实源，一旦有人往里手写，测试就从「引擎与需求文档一致吗」退化成
                 * 「引擎与某人的记忆一致吗」（纪律 PT-3 点名的风险）。
                 *
                 * 真实发生过一次：有人在这里补了 3 行「验收中」——待验收→验收中→验收通过／
                 * 不通过。需求文档全文没有「验收中」三个字（5.2.5 转换表只有 4 行、3 个状态值），
                 * 大概是为了凑上 5.13「状态值数」那一列误写的「4」。后果不是红一条，
                 * 而是红 9 条，且报错文案是「引擎缺少转换」——把矛头指向了正确的一方，
                 * 排查的人会先去给引擎补一个不存在的状态。
                 */
                throw new IllegalStateException(
                        "第 %d 行的需求文档行号是 %d，说明它是手工加进来的：%s%n"
                                .formatted(i + 1, sourceLine, lines.get(i))
                                + "这份 CSV 必须整份由 scripts/statemachine/extract-transitions.mjs 生成。"
                                + "引擎缺转换要改引擎，需求变了要改需求文档再重跑脚本，"
                                + "都不是改这里。");
            }
            rows.add(new RequirementTransitionCsv(
                    cells.get(0), cells.get(1), cells.get(2), cells.get(3),
                    cells.get(4), cells.get(5), cells.get(6), sourceLine));
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
