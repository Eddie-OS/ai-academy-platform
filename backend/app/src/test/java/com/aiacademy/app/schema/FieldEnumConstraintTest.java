package com.aiacademy.app.schema;

import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.kase.domain.CaseEnums;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.training.domain.TrainingEnums;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 字段枚举的两份定义必须逐字一致：Java 侧的 {@code *Enums} 与建表脚本的 CHECK 约束。
 *
 * <p>这两份是同一批取值的两个来源（第三份在前端，由 {@code /api/meta/field-enums} 下发，
 * 因此不会漂移）。漂移的症状很难查：表单下拉里选得到「体验优化」，保存时数据库抛
 * {@code violates check constraint}，报到运营那里是一句「保存失败」。
 *
 * <p>断言方向是双向的：Java 侧多一个值 → 保存必失败；CHECK 侧多一个值 → 历史数据里会出现
 * 表单选不到的取值，筛选下拉永远漏掉它们。
 */
class FieldEnumConstraintTest {

    /** 约束名 → Java 侧的取值表。 */
    private static final Map<String, List<String>> EXPECTED = Map.ofEntries(
            Map.entry("ck_demand_source", DemandEnums.SOURCES),
            Map.entry("ck_demand_type", DemandEnums.TYPES),
            Map.entry("ck_demand_priority", DemandEnums.PRIORITIES),
            Map.entry("ck_demand_outlet", DemandEnums.OUTLETS),
            Map.entry("ck_demand_acceptance_result", DemandEnums.ACCEPTANCE_RESULTS),
            Map.entry("ck_course_review_track", CourseEnums.REVIEW_TRACKS),
            Map.entry("ck_course_validity_period", CourseEnums.VALIDITY_PERIODS),
            Map.entry("ck_course_material_type", CourseEnums.MATERIAL_TYPES),
            Map.entry("ck_course_version_status", CourseEnums.VERSION_STATUSES),
            Map.entry("ck_course_review_result", CourseEnums.REVIEW_RESULTS),
            Map.entry("ck_training_form", TrainingEnums.FORMS),
            Map.entry("ck_attendance_status", TrainingEnums.ATTEND_STATUSES),
            Map.entry("ck_session_attendee_join_source", TrainingEnums.JOIN_SOURCES),
            Map.entry("ck_lecturer_join_type", LecturerEnums.JOIN_TYPES),
            Map.entry("ck_lecturer_training_state", LecturerEnums.TRAINING_STATES),
            Map.entry("ck_lecturer_pool_state", LecturerEnums.POOL_STATES),
            Map.entry("ck_training_feedback_scene", TrainingEnums.FEEDBACK_SCENES),
            Map.entry("ck_case_review_result", CaseEnums.REVIEW_RESULTS),
            Map.entry("ck_case_report_generate_mode", CaseEnums.GENERATE_MODES));

    @Test
    @DisplayName("STK-1：Java 侧的字段枚举与建表脚本的 CHECK 约束逐字一致")
    void 枚举与约束一致() {
        List<String> mismatches = new ArrayList<>();

        EXPECTED.forEach((constraint, expected) -> {
            String definition = definitionOf(constraint);
            if (definition == null) {
                mismatches.add(constraint + "：约束不存在，可能是被改名或删掉了");
                return;
            }
            List<String> actual = valuesIn(definition);
            if (!actual.equals(expected)) {
                mismatches.add("%s：CHECK 里是 %s，Java 侧是 %s".formatted(constraint, actual, expected));
            }
        });

        assertThat(mismatches)
                .describedAs("两侧不一致时，界面能选到的取值保存会被数据库拒绝，报到运营那里只是「保存失败」")
                .isEmpty();
    }

    private static String definitionOf(String constraintName) {
        List<String> rows = MigratedSchema.query(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = '"
                        + constraintName + "'");
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 从 {@code CHECK ((x)::text = ANY ((ARRAY['a'::character varying, ...])::text[]))} 里取出取值。 */
    private static List<String> valuesIn(String constraintDefinition) {
        List<String> values = new ArrayList<>();
        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("'((?:[^']|'')*)'").matcher(constraintDefinition);
        while (matcher.find()) {
            String value = matcher.group(1).replace("''", "'");
            // 约束定义里除取值外还夹着类型名（character varying / text），它们不是取值
            if (!value.isBlank() && !value.startsWith("character") && !value.equals("text")) {
                values.add(value);
            }
        }
        return values;
    }
}
