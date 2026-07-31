package com.aiacademy.platform.dict.domain;

import java.time.OffsetDateTime;

/**
 * 任务派生规则一行（需求 13.1.2 的 10 条，开发 5.9.1）。消费方（自动派生任务）在阶段 3。
 *
 * @param dueBase       截止时间基准。{@code CREATE_DATE} = 触发日 + {@link #dueOffsetDays}；
 *                      {@code OBJECT_FIELD:<列名>} = 直接取对象上那一列的值。
 *                      <b>只读</b>：换基准等于换取数逻辑，不是配置项
 * @param dueOffsetDays 偏移天数，可配置（需求 13.1.2「默认截止天数须支持后台配置」）。
 *                      {@code OBJECT_FIELD} 基准下为 null
 */
public record TaskDeriveRule(
        Long id,
        String taskType,
        String titleTemplate,
        String ownerSource,
        String dueBase,
        Integer dueOffsetDays,
        Boolean enabled,
        OffsetDateTime updatedAt,
        String updatedBy) {

    private static final String OBJECT_FIELD_PREFIX = "OBJECT_FIELD:";

    /** 界面上把基准显示成人话，免得让运营去理解 {@code OBJECT_FIELD:expect_publish_date}。 */
    public String dueBaseLabel() {
        if (dueBase != null && dueBase.startsWith(OBJECT_FIELD_PREFIX)) {
            return "取对象字段：" + dueBase.substring(OBJECT_FIELD_PREFIX.length());
        }
        return "触发日 + N 天";
    }

    public boolean takesDueFromObjectField() {
        return dueBase != null && dueBase.startsWith(OBJECT_FIELD_PREFIX);
    }
}
