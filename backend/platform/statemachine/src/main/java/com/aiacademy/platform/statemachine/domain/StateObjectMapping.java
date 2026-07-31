package com.aiacademy.platform.statemachine.domain;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 一类对象的状态落在哪张表的哪些列上。
 *
 * <p>状态机的主键是「对象类型 + 状态字段名」（开发 5.1.3），一个对象类型可以有多个状态字段
 * ——需求有 5 个、课程有 5 个——所以这里是一个 {@code 状态字段名 → 列名} 的映射，不是一列。
 *
 * @param optimisticLocked 表上是否有 {@code version} 列。规则 K1 只给需求、课程、案例三张表加，
 *                         因此写状态的 SQL 有带不带版本号两种形态
 */
public record StateObjectMapping(
        String objectType,
        String table,
        boolean optimisticLocked,
        Map<String, String> stateColumns) {

    public StateObjectMapping {
        stateColumns = Map.copyOf(stateColumns);
    }

    /** 状态字段名对应的列名。字段名不属于本对象类型时抛异常——那是转换表与建表脚本脱节了。 */
    public String columnOf(String stateField) {
        String column = stateColumns.get(stateField);
        if (column == null) {
            throw new IllegalStateException("对象类型 %s 没有状态字段「%s」，已登记的是 %s"
                    .formatted(objectType, stateField, stateColumns.keySet()));
        }
        return column;
    }

    static Builder table(String objectType, String table) {
        return new Builder(objectType, table, false);
    }

    /** 需求、课程、案例三张表带 {@code version}（规则 K1）。 */
    static Builder lockedTable(String objectType, String table) {
        return new Builder(objectType, table, true);
    }

    static final class Builder {

        private final String objectType;
        private final String table;
        private final boolean optimisticLocked;
        private final Map<String, String> columns = new LinkedHashMap<>();

        private Builder(String objectType, String table, boolean optimisticLocked) {
            this.objectType = objectType;
            this.table = table;
            this.optimisticLocked = optimisticLocked;
        }

        Builder state(String stateField, String column) {
            columns.put(stateField, column);
            return this;
        }

        StateObjectMapping build() {
            return new StateObjectMapping(objectType, table, optimisticLocked, columns);
        }
    }
}
