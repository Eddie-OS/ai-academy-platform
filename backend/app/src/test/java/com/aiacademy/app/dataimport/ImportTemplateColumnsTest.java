package com.aiacademy.app.dataimport;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.platform.dataimport.ImportHandler;
import com.aiacademy.platform.dataimport.domain.ImportColumn;
import com.aiacademy.platform.dataimport.domain.ImportType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 6 类导入的模板列声明与<b>需求文档第 14 章的表格</b>逐列对账。
 *
 * <p><b>为什么这个测试不是多余的：</b>模板 xlsx 与上传文件的表头校验在代码里同源
 * （{@code ImportTemplateSpec} 既生成模板又校验表头），所以「模板与解析器一致」是结构保证，
 * 不需要测。但同源保证不了「与需求一致」——把「培训场次ID」写成「场次ID」时，模板和解析器一起错，
 * 所有导入测试仍然全绿，直到人工验收时才发现运营手里的模板与需求正文对不上。
 *
 * <p>因此这里的数据源是需求文档本身：{@code scripts/import/extract-template-columns.mjs} 机械解析
 * 第 14 章的列表格，测试拿解析结果去对账 Java 里手写的列声明。需求第 14 章改动后必须重跑脚本。
 * 这是纪律 PT-3（不写断言恒真的测试）在导入模板上的落地。
 */
class ImportTemplateColumnsTest extends IntegrationTest {

    private static final String RESOURCE = "/dataimport/requirement-template-columns.csv";

    @Autowired
    private List<ImportHandler> handlers;

    @Test
    @DisplayName("需求第 14 章的 31 列全部逐列对上：列名、顺序、必填三项一致")
    void 模板列与需求文档一致() {
        Map<ImportType, List<RequirementColumn>> expected = loadExpected();
        Map<ImportType, ImportHandler> byType = new EnumMap<>(ImportType.class);
        handlers.forEach(handler -> byType.put(handler.type(), handler));

        assertThat(expected.keySet())
                .describedAs("需求第 14 章有 6 类导入模板（14.2 组织架构 V1.2 已删除）")
                .hasSize(6);

        for (Map.Entry<ImportType, List<RequirementColumn>> entry : expected.entrySet()) {
            ImportType type = entry.getKey();
            ImportHandler handler = byType.get(type);
            assertThat(handler).describedAs("缺少 %s 的 Handler", type).isNotNull();

            List<ImportColumn> actual = handler.template().columns();
            List<RequirementColumn> want = entry.getValue();

            assertThat(actual.stream().map(ImportColumn::header).toList())
                    .describedAs("%s（需求 %s）的列名与顺序必须与需求表格逐字一致——"
                            + "运营手里的模板表头对不上需求正文，验收时无法判定谁是对的",
                            type, want.get(0).sourceRef())
                    .containsExactlyElementsOf(want.stream().map(RequirementColumn::header).toList());

            for (int i = 0; i < want.size(); i++) {
                assertThat(actual.get(i).required())
                        .describedAs("%s 的「%s」列必填标记（需求文档第 %d 行标的是 %s）",
                                type, want.get(i).header(), want.get(i).sourceLine(),
                                want.get(i).required() ? "M" : "O")
                        .isEqualTo(want.get(i).required());
            }
        }
    }

    @Test
    @DisplayName("两类反馈的工号列必须是选填——它就是匿名（E1-7）的入口")
    void 反馈工号列选填() {
        Map<ImportType, List<RequirementColumn>> expected = loadExpected();

        assertThat(expected.get(ImportType.TRAINING_FEEDBACK).get(1))
                .satisfies(column -> {
                    assertThat(column.header()).isEqualTo("学员工号");
                    assertThat(column.required())
                            .describedAs("需求 14.6 B 列标的是 O：留空即匿名。"
                                    + "标成必填就等于取消了匿名，而匿名是对填问卷学员的承诺")
                            .isFalse();
                });
        assertThat(expected.get(ImportType.TRIAL_FEEDBACK).get(1))
                .satisfies(column -> {
                    assertThat(column.header()).isEqualTo("反馈人工号");
                    assertThat(column.required()).isFalse();
                });
    }

    // -------------------------------------------------------------------------

    private record RequirementColumn(ImportType type, int ordinal, String header,
                                     boolean required, int sourceLine) {
        String sourceRef() {
            return "第 14 章第 " + sourceLine + " 行起";
        }
    }

    private Map<ImportType, List<RequirementColumn>> loadExpected() {
        Map<ImportType, List<RequirementColumn>> byType = new LinkedHashMap<>();
        for (String line : readLines()) {
            if (line.isBlank() || line.startsWith("importType")) {
                continue;
            }
            String[] cells = line.split(",");
            RequirementColumn column = new RequirementColumn(
                    ImportType.valueOf(cells[0]), Integer.parseInt(cells[1]), cells[2],
                    Boolean.parseBoolean(cells[3]), Integer.parseInt(cells[4]));
            byType.computeIfAbsent(column.type(), key -> new ArrayList<>()).add(column);
        }
        if (byType.isEmpty()) {
            throw new IllegalStateException(
                    "未解析到任何模板列。先执行：node scripts/import/extract-template-columns.mjs");
        }
        return byType;
    }

    private List<String> readLines() {
        try (InputStream in = getClass().getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("缺少 " + RESOURCE
                        + "，先执行：node scripts/import/extract-template-columns.mjs");
            }
            return List.of(new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\r?\n"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
