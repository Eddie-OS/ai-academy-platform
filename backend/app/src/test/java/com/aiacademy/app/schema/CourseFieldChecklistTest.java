package com.aiacademy.app.schema;

import com.aiacademy.app.schema.RequirementFields.Field;
import com.aiacademy.app.web.dto.CourseVO;
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
 * 需求第 9 章课程字段清单与实现的逐项核对（阶段 2 出口准则 E2-2）。
 *
 * <p><b>为什么必须机器核对。</b>E2-2 的验收动作写的是「用清单勾选，不靠印象」——第 9 章有 64 个
 * 课程字段，人工逐项对一遍要小半天，而且只对得准这一次。漏一个字段的症状是它在页面上根本
 * 不存在，没有任何报错，往往到阶段 3 按这个字段统计时才发现：那时已经积累了一批缺字段的数据。
 *
 * <p>数据源是需求文档本身：{@code scripts/schema/extract-field-specs.mjs} 机械解析第 8–13 章的
 * markdown 表格生成 CSV，这里拿它逐行对账。<b>下面的 {@link #LANDING} 是唯一手写的一份映射</b>，
 * 漏登记一个字段测试就红，落点写错了列名测试也红。
 *
 * <p>核对表在测试输出里打印一份，人工验收直接引用。
 */
class CourseFieldChecklistTest {

    /** 只核对课程的章节。9.7a 试讲反馈随阶段 1 的导入落地，同属课程模块，一并核。 */
    private static final Set<String> COURSE_SECTIONS =
            Set.of("9.3.1", "9.3.2", "9.3.3", "9.6.1", "9.7.1", "9.7a.1");

    /** 库表落点之外的三种合法归宿，写成前缀而不是特例判断，核对表上一眼能看出是哪一类。 */
    private static final String DERIVED = "派生:";
    private static final String ATTACHMENT = "附件:";
    private static final String DELETED = "已删除:";

    /**
     * 需求字段 → 实现落点。键是「章节#序号」，与需求表格的行号一一对应。
     *
     * <p><b>新增字段时必须在这里登记</b>，否则 {@link #清单逐项有落点()} 会红。这正是它的用途：
     * 需求第 9 章改了字段，重跑抽取脚本后 CSV 多出一行，测试立刻指出实现还没跟上。
     */
    private static final Map<String, String> LANDING = landing();

    private static Map<String, String> landing() {
        Map<String, String> map = new LinkedHashMap<>();

        // 9.3.1 基本信息
        map.put("9.3.1#1", "biz_course.course_no");
        map.put("9.3.1#2", "biz_course.course_name");
        map.put("9.3.1#3", "biz_course.review_track");
        map.put("9.3.1#4", "biz_course.domain_code");
        map.put("9.3.1#5", "biz_course.owner_no");
        map.put("9.3.1#6", DELETED + "V1.2 删除代理机制（N19）。库里保留 deputy_id 列，实体与表单都不含它");
        map.put("9.3.1#7", "biz_course.initiated_date");
        map.put("9.3.1#8", "biz_course.expect_publish_date");
        map.put("9.3.1#9", "biz_course.summary");
        map.put("9.3.1#10", "biz_course.target_audience");
        map.put("9.3.1#11", "biz_course.class_hours");
        map.put("9.3.1#12", "biz_course.category_code");
        map.put("9.3.1#12a", "biz_course.validity_period");
        map.put("9.3.1#12b", "biz_course.validity_end_date");
        map.put("9.3.1#12c", DERIVED + "expired");
        map.put("9.3.1#12d", "biz_course.external_link");

        // 9.3.2 状态字段。五列全部只由状态机引擎写（C1、C4）
        map.put("9.3.2#13", "biz_course.main_state");
        map.put("9.3.2#14", "biz_course.dev_state");
        map.put("9.3.2#15", "biz_course.selfcheck_state");
        map.put("9.3.2#16", "biz_course.trial_state");
        map.put("9.3.2#17", "biz_course.publish_state");
        map.put("9.3.2#18", "biz_course.first_publish_date");
        map.put("9.3.2#19", "biz_course.quality_marks");
        map.put("9.3.2#20", "biz_course.close_reason");

        // 9.3.3 课程材料与当前版本
        map.put("9.3.3#21", "biz_course.current_material_version");
        map.put("9.3.3#22", "dtl_course_material.material_type");
        map.put("9.3.3#23", "dtl_course_material.material_type");
        map.put("9.3.3#24", "dtl_course_material.material_type");

        // 9.6.1 评审记录
        map.put("9.6.1#1", "dtl_course_review.id");
        map.put("9.6.1#2", "dtl_course_review.course_id");
        map.put("9.6.1#3", "dtl_course_review.round_no");
        map.put("9.6.1#4", "dtl_course_review.bound_version_no");
        map.put("9.6.1#5", "dtl_course_review.review_forms");
        map.put("9.6.1#6", "dtl_course_review.review_date");
        map.put("9.6.1#7", "dtl_course_review.participants");
        map.put("9.6.1#8", "dtl_course_review.review_result");
        map.put("9.6.1#9", "dtl_course_review.review_opinion");
        map.put("9.6.1#10", "dtl_course_review.issue_list");
        map.put("9.6.1#11", ATTACHMENT + "COURSE_REVIEW");
        map.put("9.6.1#12", "dtl_course_review.record_state");
        map.put("9.6.1#13", "dtl_course_review.created_by");

        // 9.7.1 试讲记录
        map.put("9.7.1#1", "dtl_course_trial.id");
        map.put("9.7.1#2", "dtl_course_trial.course_id");
        map.put("9.7.1#3", "dtl_course_trial.round_no");
        map.put("9.7.1#4", "dtl_course_trial.trial_date");
        map.put("9.7.1#5", "dtl_course_trial.lecturer_id");
        map.put("9.7.1#6", "dtl_course_trial.participants");
        map.put("9.7.1#7", "dtl_course_trial.acceptance_checks");
        map.put("9.7.1#8", "dtl_course_trial.course_conclusion");
        map.put("9.7.1#9", "dtl_course_trial.lecturer_conclusion");
        map.put("9.7.1#10", "dtl_course_trial.inconsistent");
        map.put("9.7.1#11", "dtl_course_trial.expert_opinion");
        map.put("9.7.1#12", "dtl_course_trial.issue_list");
        map.put("9.7.1#13", ATTACHMENT + "COURSE_TRIAL");
        map.put("9.7.1#14", "dtl_course_trial.record_state");
        map.put("9.7.1#15", "dtl_course_trial.created_by");

        // 9.7a.1 试讲反馈（阶段 1 的试讲反馈导入落地）
        map.put("9.7a.1#1", "dtl_trial_feedback.id");
        map.put("9.7a.1#2", "dtl_trial_feedback.trial_id");
        map.put("9.7a.1#3", "dtl_trial_feedback.submitter_no");
        map.put("9.7a.1#4", "dtl_trial_feedback.submitter_name");
        map.put("9.7a.1#5", "dtl_trial_feedback.score");
        map.put("9.7a.1#6", "dtl_trial_feedback.content");
        map.put("9.7a.1#7", "dtl_trial_feedback.import_batch_no");
        map.put("9.7a.1#8", "dtl_trial_feedback.imported_at");

        return Map.copyOf(map);
    }

    @Test
    @DisplayName("E2-2：需求第 9 章的课程字段逐项有落点，且登记的落点真实存在")
    void 清单逐项有落点() {
        List<Field> fields = courseFields();
        assertThat(fields)
                .describedAs("一条都没读到说明 CSV 路径或章节过滤错了，核对表会全绿而什么都没核")
                .hasSizeGreaterThan(50);

        List<String> unregistered = new ArrayList<>();
        List<String> broken = new ArrayList<>();
        List<String> rows = new ArrayList<>();

        Set<String> voComponents = Arrays.stream(CourseVO.class.getRecordComponents())
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
            } else if (landing.startsWith(DERIVED)) {
                String component = landing.substring(DERIVED.length());
                verdict = voComponents.contains(component) ? "实时计算，不落库（EX7）"
                        : "CourseVO 里没有 " + component;
                if (!voComponents.contains(component)) {
                    broken.add(field.key() + " " + field.name() + "：" + verdict);
                }
            } else if (landing.startsWith(ATTACHMENT)) {
                verdict = "通用附件表 sys_attachment_ref";
                if (!MigratedSchema.hasColumn("sys_attachment_ref", "ref_type")) {
                    broken.add(field.key() + " " + field.name() + "：附件引用表缺 ref_type");
                }
            } else {
                String[] parts = landing.split("\\.", 2);
                boolean exists = MigratedSchema.hasColumn(parts[0], parts[1]);
                verdict = exists ? "已建列" : "列不存在";
                if (!exists) {
                    broken.add(field.key() + " " + field.name() + " → " + landing + "：列不存在");
                }
            }
            rows.add("| %-8s | %-16s | %-42s | %s |".formatted(
                    field.key(), field.name(), landing, verdict));
        }

        System.out.println("=== E2-2 课程字段核对表（需求第 9 章 " + fields.size() + " 项）===");
        rows.forEach(System.out::println);

        assertThat(unregistered)
                .describedAs("需求第 9 章有这些字段，实现里没有登记落点。新增字段要么建列，"
                        + "要么在 LANDING 里写明它为什么不落库")
                .isEmpty();
        assertThat(broken)
                .describedAs("登记的落点与真实 schema 对不上——这比漏登记更危险，核对表看起来是满的")
                .isEmpty();
    }

    @Test
    @DisplayName("核对表里不许留下已经不在需求里的字段登记")
    void 登记表没有多余项() {
        Set<String> actual = courseFields().stream().map(Field::key).collect(Collectors.toSet());

        List<String> stale = LANDING.keySet().stream()
                .filter(key -> !actual.contains(key))
                .toList();

        assertThat(stale)
                .describedAs("需求删掉的字段要一并从登记表移走，否则这张表会越读越不可信")
                .isEmpty();
    }

    // -------------------------------------------------------------------------

    private static List<Field> courseFields() {
        return RequirementFields.of(COURSE_SECTIONS);
    }
}
