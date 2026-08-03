package com.aiacademy.app.schema;

import com.aiacademy.app.schema.RequirementFields.Field;
import com.aiacademy.app.web.dto.DemandVO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 需求第 8 章需求字段清单与实现的逐项核对（阶段 2 出口准则 E2-2）。
 *
 * <p>与 {@link CourseFieldChecklistTest} 是同一套做法，理由也相同：E2-2 的验收动作写的是
 * 「用清单勾选，不靠印象」，而漏一个字段的症状是它在页面上根本不存在，没有任何报错。数据源同样
 * 是 {@code scripts/schema/extract-field-specs.mjs} 从需求文档机械解析出的 CSV。
 *
 * <p><b>需求侧比课程侧多一类落点：阶段 3。</b>灯色与停滞天数属 {@code aggregate/warning}，本阶段
 * 只在列表页留出列位。写成 {@link #STAGE3} 前缀而不是从清单里删掉，是为了让核对表上这两行仍然
 * 出现——一张「全绿但少两行」的表比一张有两行写着待办的表更容易骗过验收。
 */
class DemandFieldChecklistTest {

    /** 需求对象的字段章节。8.4「需求与课程的关联」是关联表而非字段表，解析脚本不收，单独一条测试核。 */
    private static final Set<String> DEMAND_SECTIONS = Set.of("8.3.1", "8.3.2", "8.3.3", "8.3.4", "8.3.5");

    private static final String DERIVED = "派生:";
    private static final String ATTACHMENT = "附件:";
    private static final String DELETED = "已删除:";
    private static final String STAGE3 = "阶段3:";

    /**
     * 需求字段 → 实现落点。键是「章节#序号」，与需求表格的行号一一对应。
     *
     * <p><b>新增字段时必须在这里登记</b>，否则 {@link #清单逐项有落点()} 会红。
     */
    private static final Map<String, String> LANDING = landing();

    private static Map<String, String> landing() {
        Map<String, String> map = new LinkedHashMap<>();

        // 8.3.1 基本信息
        map.put("8.3.1#1", "biz_demand.demand_no");
        map.put("8.3.1#2", "biz_demand.demand_name");
        map.put("8.3.1#3", "biz_demand.domain_code");
        map.put("8.3.1#4", "biz_demand.proposer_no");
        map.put("8.3.1#5", "biz_demand.proposer_dept");
        map.put("8.3.1#6", "biz_demand.owner_no");
        map.put("8.3.1#7", DELETED + "V1.2 删除代理机制（N19）。库里保留 deputy_id 列，实体与表单都不含它");
        map.put("8.3.1#8", "biz_demand.proposed_date");
        map.put("8.3.1#9", "biz_demand.expect_finish_date");
        map.put("8.3.1#10", "biz_demand.description");
        map.put("8.3.1#11", "biz_demand.demand_source");
        map.put("8.3.1#12", "biz_demand.demand_type");
        map.put("8.3.1#13", "biz_demand.priority");

        // 8.3.2 评审信息。会议纪要走通用附件表，ref_field = review_minutes
        map.put("8.3.2#14", "biz_demand.review_state");
        map.put("8.3.2#15", "biz_demand.review_date");
        map.put("8.3.2#16", "biz_demand.review_conclusion");
        map.put("8.3.2#17", "biz_demand.review_opinion");
        map.put("8.3.2#18", ATTACHMENT + "DEMAND/review_minutes");

        // 8.3.3 分流与处理。两个出口各占一组字段，出口一 solution_*，出口二 dev_* 与三个上线字段
        map.put("8.3.3#19", "biz_demand.outlet");
        map.put("8.3.3#20", DELETED + "V1.2 删除。出口三取消后「复用工具名称」无处可用");
        map.put("8.3.3#21", "biz_demand.solution_state");
        map.put("8.3.3#22", "biz_demand.solution_name");
        map.put("8.3.3#23", ATTACHMENT + "DEMAND/solution_files");
        map.put("8.3.3#24", "biz_demand.dev_state");
        map.put("8.3.3#25", "biz_demand.first_online_date");
        map.put("8.3.3#26", "biz_demand.latest_online_date");
        map.put("8.3.3#27", "biz_demand.optimize_count");

        // 8.3.4 交付、业务验收与归档。
        // 交付使用标记与归档标记不是两个布尔：需求 5.13 第 5 项把两者归为一个状态机「需求交付标记」，
        // 因此 28 与 35 落在同一列的两个取值上（「已交付」「已归档」）
        map.put("8.3.4#28", "biz_demand.delivery_mark");
        map.put("8.3.4#29", "biz_demand.delivered_at");
        map.put("8.3.4#30", "biz_demand.acceptance_state");
        map.put("8.3.4#31", "biz_demand.acceptor_name");
        map.put("8.3.4#32", "biz_demand.accepted_at");
        map.put("8.3.4#33", "biz_demand.acceptance_opinion");
        map.put("8.3.4#34", "biz_demand.acceptance_round");
        map.put("8.3.4#35", "biz_demand.delivery_mark");
        map.put("8.3.4#36", "biz_demand.archived_at");

        // 8.3.5 全对象通用的系统字段
        map.put("8.3.5#S1", "biz_demand.created_by");
        map.put("8.3.5#S2", "biz_demand.updated_at");
        map.put("8.3.5#S3", "biz_demand.last_state_changed_at");
        map.put("8.3.5#S4", STAGE3 + "灯色由 aggregate/warning 按 13.4.1a 实时算，列表页已留出列位");
        map.put("8.3.5#S5", STAGE3 + "停滞天数同上，依据是 last_state_changed_at");
        map.put("8.3.5#S6", "biz_demand.deleted");

        return Map.copyOf(map);
    }

    /**
     * 多轮记录的两张从表。需求第 8 章的字段清单只写主对象，这两张表是 5.2.1「可反复评审」与
     * 5.2.5「可反复验收，不设轮次上限」推导出来的：主表只存最新一轮，历史留在从表。
     */
    private static final Map<String, List<String>> DETAIL_TABLES = Map.of(
            "dtl_demand_review", List.of("demand_id", "round_no", "review_date",
                    "review_conclusion", "review_opinion"),
            "dtl_demand_acceptance", List.of("demand_id", "round_no", "acceptor_name",
                    "accepted_at", "acceptance_result", "acceptance_opinion"));

    /** 需求 8.4 的关联表（规则 R1：不用外键字段表达 N:N）。 */
    private static final List<String> LINK_COLUMNS =
            List.of("demand_id", "course_id", "link_note", "created_at", "created_by");

    @Test
    @DisplayName("E2-2：需求第 8 章的需求字段逐项有落点，且登记的落点真实存在")
    void 清单逐项有落点() {
        List<Field> fields = demandFields();
        assertThat(fields)
                .describedAs("一条都没读到说明 CSV 路径或章节过滤错了，核对表会全绿而什么都没核")
                .hasSizeGreaterThan(35);

        List<String> unregistered = new ArrayList<>();
        List<String> broken = new ArrayList<>();
        List<String> rows = new ArrayList<>();

        Set<String> voComponents = Arrays.stream(DemandVO.class.getRecordComponents())
                .map(RecordComponent::getName)
                .collect(Collectors.toSet());

        for (Field field : fields) {
            String landing = LANDING.get(field.key());
            if (landing == null) {
                unregistered.add(field.key() + " " + field.name());
                continue;
            }

            String verdict;
            if (landing.startsWith(DELETED)) {
                verdict = field.deleted() ? "已删除" : "登记为已删除，但需求清单未标删除";
                if (!field.deleted()) {
                    broken.add(field.key() + " " + field.name() + "：" + verdict);
                }
            } else if (field.deleted()) {
                verdict = "需求已删除该字段，却登记了落点";
                broken.add(field.key() + " " + field.name() + "：" + verdict);
            } else if (landing.startsWith(STAGE3)) {
                verdict = "阶段 3 落地（aggregate/warning）";
            } else if (landing.startsWith(DERIVED)) {
                String component = landing.substring(DERIVED.length());
                verdict = voComponents.contains(component) ? "实时计算，不落库"
                        : "DemandVO 里没有 " + component;
                if (!voComponents.contains(component)) {
                    broken.add(field.key() + " " + field.name() + "：" + verdict);
                }
            } else if (landing.startsWith(ATTACHMENT)) {
                verdict = "通用附件表 sys_attachment_ref";
                if (!MigratedSchema.hasColumn("sys_attachment_ref", "ref_field")) {
                    broken.add(field.key() + " " + field.name() + "：附件引用表缺 ref_field");
                }
            } else {
                String[] parts = landing.split("\\.", 2);
                boolean exists = MigratedSchema.hasColumn(parts[0], parts[1]);
                verdict = exists ? "已建列" : "列不存在";
                if (!exists) {
                    broken.add(field.key() + " " + field.name() + " → " + landing + "：列不存在");
                }
            }
            rows.add("| %-9s | %-18s | %-46s | %s |".formatted(
                    field.key(), field.name(), landing, verdict));
        }

        System.out.println("=== E2-2 需求字段核对表（需求第 8 章 " + fields.size() + " 项）===");
        rows.forEach(System.out::println);

        assertThat(unregistered)
                .describedAs("需求第 8 章有这些字段，实现里没有登记落点。新增字段要么建列，"
                        + "要么在 LANDING 里写明它为什么不落库")
                .isEmpty();
        assertThat(broken)
                .describedAs("登记的落点与真实 schema 对不上——这比漏登记更危险，核对表看起来是满的")
                .isEmpty();
    }

    @Test
    @DisplayName("核对表里不许留下已经不在需求里的字段登记")
    void 登记表没有多余项() {
        Set<String> actual = demandFields().stream().map(Field::key).collect(Collectors.toSet());

        List<String> stale = LANDING.keySet().stream()
                .filter(key -> !actual.contains(key))
                .toList();

        assertThat(stale)
                .describedAs("需求删掉的字段要一并从登记表移走，否则这张表会越读越不可信")
                .isEmpty();
    }

    @Test
    @DisplayName("E2-2：多轮评审与多轮验收的两张从表列齐全（需求 5.2.1、5.2.5）")
    void 从表的列齐全() {
        List<String> missing = new ArrayList<>();
        DETAIL_TABLES.forEach((table, columns) -> columns.stream()
                .filter(column -> !MigratedSchema.hasColumn(table, column))
                .forEach(column -> missing.add(table + "." + column)));

        assertThat(missing)
                .describedAs("主表只存最新一轮。从表缺列时，历史轮次表面上还在，翻开却少一栏")
                .isEmpty();
    }

    @Test
    @DisplayName("E2-2／R1：需求 8.4 的关联落在 rel_demand_course 上，且不是主表上的外键列")
    void 关联表按关联表建() {
        List<String> missing = LINK_COLUMNS.stream()
                .filter(column -> !MigratedSchema.hasColumn("rel_demand_course", column))
                .toList();
        assertThat(missing).describedAs("需求 8.4 的关联字段缺列").isEmpty();

        assertThat(MigratedSchema.hasColumn("biz_demand", "course_id"))
                .describedAs("规则 R1 禁止用外键字段表达 N:N：主表上一旦有 course_id，"
                        + "一个需求就只能关联一门课，且课程侧无法反查")
                .isFalse();
        assertThat(MigratedSchema.hasColumn("biz_course", "demand_id")).isFalse();
        assertThat(MigratedSchema.hasColumn("rel_demand_course", "deleted"))
                .describedAs("解除关联是物理删除，变更由 audit_op_log 留痕（开发 6.3.1）")
                .isFalse();
    }

    // -------------------------------------------------------------------------

    private static List<Field> demandFields() {
        return RequirementFields.of(DEMAND_SECTIONS);
    }
}
