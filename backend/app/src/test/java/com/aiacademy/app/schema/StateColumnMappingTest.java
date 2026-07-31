package com.aiacademy.app.schema;

import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.StateObjectMapping;
import com.aiacademy.platform.statemachine.domain.StateObjectMappings;
import com.aiacademy.platform.statemachine.domain.machines.StateMachineCatalog;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 校验「状态机 → 表列」映射与真实建库结果一致。
 *
 * <p><b>这是 1A 与 1B 之间的接缝，也是最容易出错又最难被发现的地方。</b>
 * {@link StateObjectMappings} 里的表名与列名是人工对着建表脚本录的，写错一个字符
 * （{@code selfcheck_state} 写成 {@code self_check_state}）编译期毫无反应，
 * 要等到阶段 2 真去转换那个状态时才炸。这里拿迁移后的真实 schema 逐条对，让它在 1B 就红。
 */
class StateColumnMappingTest {

    @Test
    @DisplayName("16 个状态机与状态列映射一一对应，不多不少")
    void 每个状态机都能找到落库的列() {
        Set<String> machines = new TreeSet<>();
        for (StateMachineDef def : StateMachineCatalog.all()) {
            machines.add(def.objectType() + "." + def.stateField());
        }

        Set<String> mapped = new TreeSet<>();
        for (StateObjectMapping mapping : StateObjectMappings.all()) {
            mapping.stateColumns().keySet()
                    .forEach(field -> mapped.add(mapping.objectType() + "." + field));
        }

        assertThat(mapped)
                .describedAs("引擎装载了 16 张转换表，就必须有 16 个状态列能写。"
                        + "多出来的映射说明建了不该有的列，少的说明某个状态机无处落库")
                .containsExactlyInAnyOrderElementsOf(machines);
        assertThat(machines).hasSize(16);
    }

    @Test
    @DisplayName("映射的表与列在迁移后的库里都真实存在，且都是字符串列")
    void 表名列名与建库脚本一致() {
        List<String> violations = new java.util.ArrayList<>();

        for (StateObjectMapping mapping : StateObjectMappings.all()) {
            if (!MigratedSchema.tableNames().contains(mapping.table())) {
                violations.add(mapping.objectType() + " → 表 " + mapping.table() + " 不存在");
                continue;
            }
            mapping.stateColumns().forEach((field, column) -> {
                if (!MigratedSchema.hasColumn(mapping.table(), column)) {
                    violations.add("%s.%s → %s.%s 列不存在"
                            .formatted(mapping.objectType(), field, mapping.table(), column));
                    return;
                }
                String type = MigratedSchema.dataTypeOf(mapping.table(), column);
                if (!"character varying".equals(type)) {
                    // 6.1.3：枚举一律中文字符串 + CHECK，不用数字码、不用 PostgreSQL ENUM 类型
                    violations.add("%s.%s → %s.%s 的类型是 %s，状态列必须是 VARCHAR"
                            .formatted(mapping.objectType(), field, mapping.table(), column, type));
                }
            });
        }

        assertThat(violations).isEmpty();
    }

    @Test
    @DisplayName("规则 K1：声明了乐观锁的映射，表上必须真有 version 列；没声明的必须真没有")
    void 乐观锁声明与建表一致() {
        List<String> violations = new java.util.ArrayList<>();

        for (StateObjectMapping mapping : StateObjectMappings.all()) {
            boolean hasVersionColumn = MigratedSchema.hasColumn(mapping.table(), "version");
            if (mapping.optimisticLocked() != hasVersionColumn) {
                violations.add("%s（%s）：映射声明 optimisticLocked=%s，实际 version 列存在=%s"
                        .formatted(mapping.objectType(), mapping.table(),
                                mapping.optimisticLocked(), hasVersionColumn));
            }
        }

        assertThat(violations)
                .describedAs("声明多了会让写状态的 SQL 去更新一个不存在的列；"
                        + "声明少了会让三张主对象表的乐观锁失效（规则 K1、K2）")
                .isEmpty();
    }

    @Test
    @DisplayName("出口准则 E1-2：每张有状态列的表都有 last_state_changed_at 可写")
    void 每张表都能记录状态变更时间() {
        List<String> violations = StateObjectMappings.all().stream()
                .map(StateObjectMapping::table)
                .filter(table -> !MigratedSchema.hasColumn(table, "last_state_changed_at"))
                .toList();

        assertThat(violations).isEmpty();
    }
}
