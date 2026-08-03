package com.aiacademy.platform.dict.repository;

import com.aiacademy.platform.dict.domain.TaskDeriveRule;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface TaskDeriveRuleMapper {

    /** 10 条固定规则（需求 13.1.2），按 id 排序即装载顺序，与需求表格的行号一致。 */
    @Select("""
            SELECT id, task_type, title_template, owner_source, due_base, due_offset_days,
                   enabled, updated_at, updated_by
              FROM cfg_task_derive_rule
             WHERE deleted = FALSE
             ORDER BY id
            """)
    List<TaskDeriveRule> findAll();

    @Select("""
            SELECT id, task_type, title_template, owner_source, due_base, due_offset_days,
                   enabled, updated_at, updated_by
              FROM cfg_task_derive_rule
             WHERE id = #{id} AND deleted = FALSE
            """)
    TaskDeriveRule findById(@Param("id") long id);

    @Select("""
            SELECT id, task_type, title_template, owner_source, due_base, due_offset_days,
                   enabled, updated_at, updated_by
              FROM cfg_task_derive_rule
             WHERE task_type = #{taskType} AND deleted = FALSE
            """)
    TaskDeriveRule findByTaskType(@Param("taskType") String taskType);

    /**
     * 可改：标题模板、截止天数、启用状态。
     *
     * <p><b>{@code due_base} 与 {@code owner_source} 不可改</b>：前者换了就是换取数逻辑
     * （课程开发那条取「课程预计发布时间」而不是 N 天，开发 5.9.1），后者一期只有一个取值。
     * 需求 13.1.2 要求可后台配置的是<b>默认截止天数</b>，不是整条规则的形态。
     */
    @Update("""
            UPDATE cfg_task_derive_rule
               SET title_template = #{titleTemplate},
                   due_offset_days = #{dueOffsetDays},
                   enabled = #{enabled},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int update(@Param("id") long id,
               @Param("titleTemplate") String titleTemplate,
               @Param("dueOffsetDays") Integer dueOffsetDays,
               @Param("enabled") boolean enabled,
               @Param("operator") String operator);
}
