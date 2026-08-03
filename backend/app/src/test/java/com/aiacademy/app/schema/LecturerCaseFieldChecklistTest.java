package com.aiacademy.app.schema;

import com.aiacademy.app.schema.RequirementFields.Field;
import com.aiacademy.app.web.dto.CaseReportVO;
import com.aiacademy.app.web.dto.CaseVO;
import com.aiacademy.app.web.dto.LecturerVO;
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
 * 需求 10.3 讲师字段与 12.3 案例字段的逐项核对（阶段 2 出口准则 E2-2，D 段）。
 *
 * <p>做法与 A／B／C 三段的核对表相同，两章合在一份里是因为它们同属 D 段、落点判定逻辑一模一样。
 *
 * <p><b>这两章的「A 系统自动生成」比前几章多得多，而它们不都是同一回事。</b>核对时分成三类：
 * <ul>
 *   <li><b>首次到达型事实</b>（首次试讲合格时间、上架时间）→ 建列，由那一次转换写入；
 *   <li><b>聚合型统计</b>（累计授课次数、浏览次数、点赞量、评论数、累计阅读时长）→ <b>不建列</b>，
 *       由明细表实时 COUNT／SUM。存一份计数器只会与明细漂移，而漂移之后没有任何一侧看得出来；
 *   <li><b>附件</b>（案例附件、封面图）→ 走通用附件表，靠 {@code ref_field} 区分。
 * </ul>
 */
class LecturerCaseFieldChecklistTest {

    private static final Set<String> LECTURER_SECTIONS = Set.of("10.3");
    private static final Set<String> CASE_SECTIONS = Set.of("12.3");

    private static final String DERIVED = "派生:";
    private static final String ATTACHMENT = "附件:";
    private static final String DELETED = "已删除:";
    private static final String STAGE3 = "阶段3:";

    private static final Map<String, String> LECTURER_LANDING = lecturerLanding();
    private static final Map<String, String> CASE_LANDING = caseLanding();

    private static Map<String, String> lecturerLanding() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("10.3#1", "biz_lecturer.lecturer_no");
        map.put("10.3#2", "biz_lecturer.lecturer_name");
        map.put("10.3#3", "biz_lecturer.employee_no");
        map.put("10.3#4", "biz_lecturer.source_dept");
        map.put("10.3#5", "biz_lecturer.expertise_domains");
        map.put("10.3#6", "biz_lecturer.teaching_direction");
        map.put("10.3#7", "biz_lecturer.join_type");
        map.put("10.3#8", "biz_lecturer.joined_date");
        map.put("10.3#8a", "biz_lecturer.training_state");
        map.put("10.3#9", "biz_lecturer.trial_qualified");
        map.put("10.3#10", "biz_lecturer.first_qualified_date");
        // 11～13 项需求标为「A 系统自动生成」，但 15.3 同时给了公式。落库要维护刷新逻辑，
        // 而 C14 明确「数据量小，实时算即可，缓存反而让运营改完数据看到旧值」
        map.put("10.3#11", DERIVED + "teachingCount");
        map.put("10.3#12", DERIVED + "attendeeCount");
        map.put("10.3#13", DERIVED + "avgScore");
        map.put("10.3#14", "biz_lecturer.pool_state");
        map.put("10.3#15", "biz_lecturer.removed_reason");
        return Map.copyOf(map);
    }

    private static Map<String, String> caseLanding() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("12.3#1", "biz_case.case_no");
        map.put("12.3#2", "biz_case.case_name");
        map.put("12.3#3", "biz_case.course_id");
        map.put("12.3#4", "biz_case.contributing_org");
        map.put("12.3#5", "biz_case.contributors");
        map.put("12.3#6", "biz_case.domain_codes");
        map.put("12.3#7", "biz_case.owner_no");
        map.put("12.3#8", DELETED + "V1.2 删除代理机制（N19）。库里保留 deputy_id 列，实体与表单都不含它");
        map.put("12.3#9", "biz_case.case_state");
        map.put("12.3#9a", "biz_case.reviewer_no");
        map.put("12.3#9b", "biz_case.reviewed_at");
        map.put("12.3#9c", "biz_case.review_opinion");
        // 审核结论只有一列、没有历史表：后一次覆盖前一次，不记轮次（C09 第 4 条）。
        // 与需求业务验收要记轮次刚好相反，不要把两者做成一样
        map.put("12.3#9d", "biz_case.review_result");
        map.put("12.3#10", "biz_case.quality_marks");
        map.put("12.3#11", "biz_case.content");
        map.put("12.3#12", ATTACHMENT + "CASE/case_files");
        map.put("12.3#13", ATTACHMENT + "CASE/case_cover");
        map.put("12.3#14", "biz_case.created_at");
        map.put("12.3#15", "biz_case.published_at");
        map.put("12.3#16", "biz_case.expect_publish_date");
        // 四项互动计数由三张明细表实时算出，不落计数器列（15.5 给了公式）
        map.put("12.3#17", DERIVED + "viewCount");
        map.put("12.3#18", DERIVED + "likeCount");
        map.put("12.3#19", DERIVED + "commentCount");
        map.put("12.3#20", DELETED + "V1.2 删除收藏功能（N21），因此也不建 dtl_case_favorite");
        map.put("12.3#21", DERIVED + "readSeconds");
        return Map.copyOf(map);
    }

    /**
     * 需求 12.4 三类互动记录的列，以及 12.6 总结报告的列。
     *
     * <p>这两节的表格没有序号列，抽取脚本收不到（同 C 段 11.5／11.6 的处理）。不核的话，
     * 12.4 在 V1.2 按共享账号模型整体重写过的那批字段——账号类型、来源IP、署名——
     * 就是第 12 章里唯一没人对过的部分。
     */
    private static final Map<String, List<String>> UNPARSED_SECTIONS = Map.of(
            "dtl_case_view", List.of("case_id", "account_type", "viewed_at", "duration_seconds", "source_ip"),
            "dtl_case_like", List.of("case_id", "account_type", "liked_at", "source_ip"),
            "dtl_case_comment", List.of("case_id", "account_type", "signature", "content",
                    "commented_at", "deleted"),
            "dtl_case_report", List.of("report_name", "period_start", "period_end",
                    "generate_mode", "content"));

    @Test
    @DisplayName("E2-2：需求 10.3 讲师字段逐项有落点，且登记的落点真实存在")
    void 讲师清单逐项有落点() {
        check("讲师", LECTURER_SECTIONS, LECTURER_LANDING, 14, componentsOf(LecturerVO.class));
    }

    @Test
    @DisplayName("E2-2：需求 12.3 案例字段逐项有落点，且登记的落点真实存在")
    void 案例清单逐项有落点() {
        check("案例", CASE_SECTIONS, CASE_LANDING, 20,
                componentsOf(CaseVO.class, CaseReportVO.class));
    }

    @Test
    @DisplayName("核对表里不许留下已经不在需求里的字段登记")
    void 登记表没有多余项() {
        assertThat(stale(LECTURER_SECTIONS, LECTURER_LANDING))
                .describedAs("需求删掉的字段要一并从登记表移走，否则这张表会越读越不可信")
                .isEmpty();
        assertThat(stale(CASE_SECTIONS, CASE_LANDING)).isEmpty();
    }

    @Test
    @DisplayName("E2-2：12.4 三张互动表与 12.6 总结报告表的列齐全（表格无序号列，抽取脚本收不到）")
    void 未被解析的两节列齐全() {
        List<String> missing = new ArrayList<>();
        UNPARSED_SECTIONS.forEach((table, columns) -> columns.stream()
                .filter(column -> !MigratedSchema.hasColumn(table, column))
                .forEach(column -> missing.add(table + "." + column)));

        assertThat(missing)
                .describedAs("这几张表的字段清单只在需求正文里，没人对过的话缺一列也不会有任何报错")
                .isEmpty();
    }

    @Test
    @DisplayName("四项互动计数不落计数器列——存一份计数器只会与明细表漂移")
    void 互动计数不落库() {
        List<String> counters = List.of("view_count", "like_count", "comment_count", "read_seconds");

        List<String> leaked = counters.stream()
                .filter(column -> MigratedSchema.hasColumn("biz_case", column))
                .toList();

        assertThat(leaked)
                .describedAs("这四项在需求 12.3 里标为「A 系统自动生成」，但 15.5 给了它们的公式。"
                        + "建了列就要在浏览、点赞、评论、删评论四条路径上各维护一次，"
                        + "漏一条的症状是页面上的数字比明细表数出来的少，而没有任何报错")
                .isEmpty();
    }

    @Test
    @DisplayName("收藏功能已删除（N21）：既没有收藏表，案例表上也没有收藏数列")
    void 没有收藏() {
        assertThat(MigratedSchema.tableNames())
                .describedAs("需求 12.3 第 20 项已删除，共享账号下没有个人身份，收藏夹无意义")
                .doesNotContain("dtl_case_favorite");
        assertThat(MigratedSchema.hasColumn("biz_case", "favorite_count")).isFalse();
    }

    // -------------------------------------------------------------------------

    private static void check(String label, Set<String> sections, Map<String, String> landing,
                              int minFields, Set<String> voComponents) {
        List<Field> fields = RequirementFields.of(sections);
        assertThat(fields)
                .describedAs("一条都没读到说明 CSV 路径或章节过滤错了，核对表会全绿而什么都没核")
                .hasSizeGreaterThanOrEqualTo(minFields);

        List<String> unregistered = new ArrayList<>();
        List<String> broken = new ArrayList<>();
        List<String> rows = new ArrayList<>();

        for (Field field : fields) {
            String target = landing.get(field.key());
            if (target == null) {
                unregistered.add(field.key() + " " + field.name());
                continue;
            }

            String verdict;
            if (target.startsWith(DELETED)) {
                verdict = field.deleted() ? "已删除" : "登记为已删除，但需求清单未标删除";
                if (!field.deleted()) {
                    broken.add(field.key() + " " + field.name() + "：" + verdict);
                }
            } else if (field.deleted()) {
                verdict = "需求已删除该字段，却登记了落点";
                broken.add(field.key() + " " + field.name() + "：" + verdict);
            } else if (target.startsWith(STAGE3)) {
                verdict = "阶段 3 落地（aggregate/warning）";
            } else if (target.startsWith(DERIVED)) {
                String component = target.substring(DERIVED.length());
                boolean present = voComponents.contains(component);
                verdict = present ? "实时计算，不落库" : "出参里没有 " + component;
                if (!present) {
                    broken.add(field.key() + " " + field.name() + "：" + verdict);
                }
            } else if (target.startsWith(ATTACHMENT)) {
                verdict = "通用附件表 sys_attachment_ref";
                if (!MigratedSchema.hasColumn("sys_attachment_ref", "ref_field")) {
                    broken.add(field.key() + " " + field.name() + "：附件引用表缺 ref_field");
                }
            } else {
                String[] parts = target.split("\\.", 2);
                boolean exists = MigratedSchema.hasColumn(parts[0], parts[1]);
                verdict = exists ? "已建列" : "列不存在";
                if (!exists) {
                    broken.add(field.key() + " " + field.name() + " → " + target + "：列不存在");
                }
            }
            rows.add("| %-10s | %-18s | %-46s | %s |".formatted(
                    field.key(), field.name(), target, verdict));
        }

        System.out.println("=== E2-2 " + label + "字段核对表（" + fields.size() + " 项）===");
        rows.forEach(System.out::println);

        assertThat(unregistered)
                .describedAs("需求里有这些字段，实现里没有登记落点。新增字段要么建列，"
                        + "要么在登记表里写明它为什么不落库")
                .isEmpty();
        assertThat(broken)
                .describedAs("登记的落点与真实 schema 对不上——这比漏登记更危险，核对表看起来是满的")
                .isEmpty();
    }

    private static List<String> stale(Set<String> sections, Map<String, String> landing) {
        Set<String> actual = RequirementFields.of(sections).stream()
                .map(Field::key)
                .collect(Collectors.toSet());
        return landing.keySet().stream().filter(key -> !actual.contains(key)).toList();
    }

    private static Set<String> componentsOf(Class<?>... records) {
        return Arrays.stream(records)
                .flatMap(type -> Arrays.stream(type.getRecordComponents()))
                .map(RecordComponent::getName)
                .collect(Collectors.toSet());
    }
}
