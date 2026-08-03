package com.aiacademy.common.json;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

/**
 * JSONB 字符串数组与 {@code List<String>} 的互转。
 *
 * <p>多选枚举（精品标注、评审形式、试讲验收标准、讲师擅长领域、案例领域）在库里统一存 JSONB
 * 值数组（建表脚本 V1_004 表头的说明）：这些字段只做展示与「是否包含某值」的筛选，不参与聚合，
 * 也没有物理删除依赖，建关联表是过度设计。
 *
 * <p>Java 侧按项目既有做法存 JSON 文本，写库时在 SQL 里用 {@code #{x}::jsonb} 转型
 * （见 {@code LecturerImportMapper}）——不引 MyBatis 的 JSONB TypeHandler，是因为只有这一种形态
 * （字符串数组），一个转换工具比一层类型处理器更容易看懂在存什么。
 */
public final class JsonArrays {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
    };

    private JsonArrays() {
    }

    /** @return JSON 数组文本；空集合返回 null 而不是 {@code []}，让「没填」在库里表现为 NULL */
    public static String toJson(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(values);
        } catch (Exception e) {
            throw new IllegalArgumentException("多选值无法序列化为 JSON：" + values, e);
        }
    }

    /**
     * @return 解析结果；null 或空串返回空列表。
     *         <b>解析失败也返回空列表而不是抛异常</b>：这是展示用的多选值，
     *         一条脏数据不该让整个列表页 500
     */
    public static List<String> toList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(json, STRING_LIST);
        } catch (Exception e) {
            return List.of();
        }
    }
}
