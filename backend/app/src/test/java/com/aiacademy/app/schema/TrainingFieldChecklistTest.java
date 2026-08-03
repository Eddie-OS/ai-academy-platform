package com.aiacademy.app.schema;

import com.aiacademy.app.schema.RequirementFields.Field;
import com.aiacademy.app.web.dto.TrainingPlanVO;
import com.aiacademy.app.web.dto.TrainingSessionVO;
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
 * 需求第 11 章培训字段清单与实现的逐项核对（阶段 2 出口准则 E2-2）。
 *
 * <p>做法与 {@code CourseFieldChecklistTest}／{@code DemandFieldChecklistTest} 相同，数据源同样是
 * {@code scripts/schema/extract-field-specs.mjs} 从需求文档机械解析出的 CSV。
 *
 * <p><b>培训侧有三张表不在 CSV 里。</b>11.5.1 参训名单、11.5.2 签到记录、11.6 培训归档的表格
 * 表头是「字段 | 类型 | 必填 | 说明」，没有序号列，抽取脚本按「# | 字段 | 类型」识别表格，收不到
 * 它们。这三节改用显式列清单核（同 8.4 关联表的做法）——不核的话，这三张表就是第 11 章里
 * 唯一没人对过的部分，而签到记录恰恰是一期使用频率最高的导入目标。
 */
class TrainingFieldChecklistTest {

    /** 有序号列、能被抽取脚本收到的三节。 */
    private static final Set<String> TRAINING_SECTIONS = Set.of("11.3", "11.4", "11.7.2");

    private static final String DERIVED = "派生:";
    private static final String DELETED = "已删除:";

    /** 需求字段 → 实现落点。键是「章节#序号」，与需求表格的行号一一对应。 */
    private static final Map<String, String> LANDING = landing();

    private static Map<String, String> landing() {
        Map<String, String> map = new LinkedHashMap<>();

        // 11.3 培训计划
        map.put("11.3#1", "biz_training_plan.plan_no");
        map.put("11.3#2", "biz_training_plan.plan_name");
        map.put("11.3#3", "biz_training_plan.course_id");
        map.put("11.3#4", "biz_training_plan.owner_no");
        map.put("11.3#5", DELETED + "V1.2 删除代理机制（N19）。库里保留 deputy_id 列，实体与表单都不含它");
        map.put("11.3#6", "biz_training_plan.target_scope");
        map.put("11.3#7", "biz_training_plan.plan_start_date");
        map.put("11.3#8", "biz_training_plan.plan_end_date");
        map.put("11.3#9", "biz_training_plan.plan_session_count");
        // 实际场次数不落库：它是下属场次的 COUNT，落库就要在建、删场次的每条路径上维护它
        map.put("11.3#10", DERIVED + "actualSessionCount");
        map.put("11.3#11", "biz_training_plan.plan_state");
        map.put("11.3#12", "biz_training_plan.actual_finish_date");
        map.put("11.3#13", "biz_training_plan.remark");

        // 11.4 培训场次
        map.put("11.4#1", "biz_training_session.session_no");
        map.put("11.4#2", "biz_training_session.plan_id");
        map.put("11.4#3", "biz_training_session.session_name");
        map.put("11.4#4", "biz_training_session.course_id");
        map.put("11.4#5", "biz_training_session.lecturer_id");
        map.put("11.4#6", "biz_training_session.training_date");
        // 第 7 项是「开始时间 / 结束时间」一行两列，落在两列上；核对表按起始列登记，end_time 由下面的列清单兜
        map.put("11.4#7", "biz_training_session.start_time");
        map.put("11.4#8", "biz_training_session.duration_hours");
        map.put("11.4#9", "biz_training_session.training_form");
        map.put("11.4#10", "biz_training_session.venue");
        map.put("11.4#11", "biz_training_session.online_link");
        map.put("11.4#12", "biz_training_session.student_scope");
        map.put("11.4#13", "biz_training_session.plan_attendee_count");
        map.put("11.4#14", DERIVED + "actualAttendeeCount");
        map.put("11.4#15", "biz_training_session.session_state");
        map.put("11.4#16", "biz_training_session.remark");

        // 11.7.2 学员反馈
        map.put("11.7.2#1", "dtl_training_feedback.id");
        map.put("11.7.2#2", "dtl_training_feedback.session_id");
        map.put("11.7.2#3", "dtl_training_feedback.submitter_no");
        map.put("11.7.2#4", "dtl_training_feedback.submitter_name");
        map.put("11.7.2#5", "dtl_training_feedback.score");
        map.put("11.7.2#6", "dtl_training_feedback.content");
        map.put("11.7.2#7", "dtl_training_feedback.feedback_scene");
        map.put("11.7.2#8", "dtl_training_feedback.import_batch_no");
        map.put("11.7.2#9", "dtl_training_feedback.imported_at");
        map.put("11.7.2#10", "dtl_training_feedback.ops_remark");
        map.put("11.7.2#11", "dtl_training_feedback.remarked_at");

        return Map.copyOf(map);
    }

    /**
     * 抽取脚本收不到的三节，按需求表格的行逐列登记。
     *
     * <p>11.6 的三类附件不在这里：它们走通用附件表 {@code sys_attachment_ref}，
     * {@code ref_field} 取 {@code ArchiveAttachmentFields} 的三个值，由 {@link #归档附件走通用附件表()} 核。
     */
    private static final Map<String, List<String>> UNPARSED_SECTIONS = Map.of(
            // 11.5.1 参训人员名单
            "dtl_session_attendee", List.of("session_id", "employee_no", "employee_name_snapshot",
                    "dept_name_snapshot", "join_source", "created_by", "created_at"),
            // 11.5.2 签到记录
            "dtl_attendance", List.of("session_id", "employee_no", "employee_name_snapshot",
                    "dept_name_snapshot", "attend_status", "attend_time", "import_batch_no",
                    "created_by", "created_at"),
            // 11.6 培训归档（V2_003 把它由「一场次多行材料」改为「一场次一条归档记录」）
            "dtl_training_archive", List.of("session_id", "live_link", "video_link", "minutes_text",
                    "archive_completed", "completed_at"));

    @Test
    @DisplayName("E2-2：需求第 11 章有序号的三节字段逐项有落点，且登记的落点真实存在")
    void 清单逐项有落点() {
        List<Field> fields = trainingFields();
        assertThat(fields)
                .describedAs("一条都没读到说明 CSV 路径或章节过滤错了，核对表会全绿而什么都没核")
                .hasSizeGreaterThan(35);

        List<String> unregistered = new ArrayList<>();
        List<String> broken = new ArrayList<>();
        List<String> rows = new ArrayList<>();

        Set<String> voComponents = new java.util.HashSet<>();
        Arrays.stream(TrainingPlanVO.class.getRecordComponents())
                .map(RecordComponent::getName).forEach(voComponents::add);
        Arrays.stream(TrainingSessionVO.class.getRecordComponents())
                .map(RecordComponent::getName).forEach(voComponents::add);

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
                boolean present = voComponents.contains(component);
                verdict = present ? "实时计算，不落库" : "出参里没有 " + component;
                if (!present) {
                    broken.add(field.key() + " " + field.name() + "：" + verdict);
                }
            } else {
                String[] parts = landing.split("\\.", 2);
                boolean exists = MigratedSchema.hasColumn(parts[0], parts[1]);
                verdict = exists ? "已建列" : "列不存在";
                if (!exists) {
                    broken.add(field.key() + " " + field.name() + " → " + landing + "：列不存在");
                }
            }
            rows.add("| %-10s | %-20s | %-46s | %s |".formatted(
                    field.key(), field.name(), landing, verdict));
        }

        System.out.println("=== E2-2 培训字段核对表（需求第 11 章 " + fields.size() + " 项）===");
        rows.forEach(System.out::println);

        assertThat(unregistered)
                .describedAs("需求第 11 章有这些字段，实现里没有登记落点")
                .isEmpty();
        assertThat(broken)
                .describedAs("登记的落点与真实 schema 对不上——这比漏登记更危险，核对表看起来是满的")
                .isEmpty();
    }

    @Test
    @DisplayName("核对表里不许留下已经不在需求里的字段登记")
    void 登记表没有多余项() {
        Set<String> actual = trainingFields().stream().map(Field::key).collect(Collectors.toSet());

        List<String> stale = LANDING.keySet().stream().filter(key -> !actual.contains(key)).toList();

        assertThat(stale)
                .describedAs("需求删掉的字段要一并从登记表移走，否则这张表会越读越不可信")
                .isEmpty();
    }

    @Test
    @DisplayName("E2-2：11.5.1／11.5.2／11.6 三节的列齐全（表格无序号列，抽取脚本收不到）")
    void 未被解析的三节列齐全() {
        List<String> missing = new ArrayList<>();
        UNPARSED_SECTIONS.forEach((table, columns) -> columns.stream()
                .filter(column -> !MigratedSchema.hasColumn(table, column))
                .forEach(column -> missing.add(table + "." + column)));

        assertThat(missing)
                .describedAs("这三张表的字段清单只在需求正文里，没人对过的话缺一列也不会有任何报错")
                .isEmpty();
    }

    @Test
    @DisplayName("11.4 第 7 项是「开始时间 / 结束时间」一行两列，结束时间同样要有列")
    void 结束时间也有列() {
        assertThat(MigratedSchema.hasColumn("biz_training_session", "end_time"))
                .describedAs("一行登记两列时，第二列最容易在核对表上被漏掉")
                .isTrue();
    }

    @Test
    @DisplayName("11.6 的三类附件走通用附件表，不在归档表里各建一列")
    void 归档附件走通用附件表() {
        assertThat(MigratedSchema.hasColumn("sys_attachment_ref", "ref_field"))
                .describedAs("三类归档附件靠 ref_field 区分（archive_photos／archive_ppt／archive_minutes）")
                .isTrue();
        assertThat(MigratedSchema.hasColumn("dtl_training_archive", "attachment_id"))
                .describedAs("V2_003 起归档表是一场次一条记录，附件挂在 sys_attachment_ref 上；"
                        + "留着单附件列会让「多附件」这条需求悄悄退化成单附件")
                .isFalse();
    }

    // -------------------------------------------------------------------------

    private static List<Field> trainingFields() {
        return RequirementFields.of(TRAINING_SECTIONS);
    }
}
