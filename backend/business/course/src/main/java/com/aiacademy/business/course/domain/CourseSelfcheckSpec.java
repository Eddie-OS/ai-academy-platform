package com.aiacademy.business.course.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 详情「自检」页规格 8 项。答案存 {@code biz_course.selfcheck_spec_answers}，
 * 不进 {@code cfg_selfcheck_item}，官方 14 条题库的完成度分母不受影响。
 */
public final class CourseSelfcheckSpec {

    public static final List<String> CODES = List.of(
            "GOAL_CLEAR",
            "STRUCTURE",
            "KEY_INFO",
            "COURSEWARE_SET",
            "PPT_STANDARD",
            "DEMO_REPRO",
            "PROMPT_USABLE",
            "HOMEWORK");

    private CourseSelfcheckSpec() {
    }

    public static String toJson(Map<String, String> answers) {
        if (answers == null || answers.isEmpty()) {
            return null;
        }
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        for (String code : CODES) {
            String value = answers.get(code);
            if (value == null || value.isBlank()) {
                continue;
            }
            if (!first) {
                json.append(',');
            }
            first = false;
            json.append('"').append(code).append("\":\"").append(value).append('"');
        }
        json.append('}');
        return first ? null : json.toString();
    }

    public static Map<String, String> fromJson(String json) {
        Map<String, String> result = new LinkedHashMap<>();
        if (json == null || json.isBlank()) {
            return result;
        }
        for (String code : CODES) {
            String key = "\"" + code + "\"";
            int keyAt = json.indexOf(key);
            if (keyAt < 0) {
                continue;
            }
            int colon = json.indexOf(':', keyAt + key.length());
            if (colon < 0) {
                continue;
            }
            int cursor = colon + 1;
            while (cursor < json.length() && Character.isWhitespace(json.charAt(cursor))) {
                cursor++;
            }
            if (cursor >= json.length() || json.charAt(cursor) != '"') {
                continue;
            }
            int valueStart = cursor + 1;
            int end = json.indexOf('"', valueStart);
            if (end > valueStart) {
                result.put(code, json.substring(valueStart, end));
            }
        }
        return result;
    }
}
