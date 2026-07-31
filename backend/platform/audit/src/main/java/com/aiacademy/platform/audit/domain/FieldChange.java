package com.aiacademy.platform.audit.domain;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 一个字段的变更，对应操作审计日志里的一行。
 *
 * @param fieldName 中文业务字段名，直接落 {@code field_name}
 */
public record FieldChange(String fieldName, String oldValue, String newValue) {

    /** {@code old_value} / {@code new_value} 两列的长度上限（开发 5.2.3）。 */
    public static final int VALUE_MAX_LENGTH = 500;

    /**
     * 比较两份字段快照，只返回真正变化的字段。
     *
     * <p><b>只记变化的字段，是需求 5.12 的字段级要求，也是一条性能约束</b>：一个对象有二三十个
     * 字段，若每次修改都全字段落库，审计表的增长速度会是实际变更量的十几倍，而 5.2.1 已经把
     * 「这张表会很大」列为它与流转日志分表的理由之一。
     *
     * <p>比较用 {@link Objects#equals} 比原值，不是比字符串：{@code 1} 与 {@code "1"}、
     * {@code null} 与 {@code ""} 在业务上不同，先转字符串会把这些差异抹平。
     */
    public static List<FieldChange> diff(Map<String, Object> before, Map<String, Object> after) {
        Set<String> fields = new LinkedHashSet<>(before.keySet());
        fields.addAll(after.keySet());

        List<FieldChange> changes = new ArrayList<>();
        for (String field : fields) {
            Object oldValue = before.get(field);
            Object newValue = after.get(field);
                if (!Objects.equals(oldValue, newValue)) {
                changes.add(new FieldChange(field, truncate(oldValue), truncate(newValue)));
            }
        }
        return changes;
    }

    private static String truncate(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString();
        return text.length() <= VALUE_MAX_LENGTH ? text : text.substring(0, VALUE_MAX_LENGTH);
    }
}
