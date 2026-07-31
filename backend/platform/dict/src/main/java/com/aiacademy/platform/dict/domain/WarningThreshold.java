package com.aiacademy.platform.dict.domain;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 三色灯阈值一行（需求 13.9.2 Tab 1，取值见 13.4.3）。
 *
 * @param blueDays 蓝灯阈值，1–30。语义是「距预计完成时间 1–{@code blueDays} 天内亮蓝灯」，
 *                 不是「第 {@code blueDays} 天亮」（需求 13.4.3 蓝灯语义说明）
 * @param redDays  红灯阈值，1–90。状态停滞超过它亮红灯，与预计完成时间无关
 */
public record WarningThreshold(
        Long id,
        String objectType,
        Integer blueDays,
        Integer redDays,
        OffsetDateTime updatedAt,
        String updatedBy) {

    /** 固定四行，不可增删（需求 13.9.2）。顺序即界面展示顺序。 */
    public static final List<String> OBJECT_TYPES = List.of("AI需求", "课程", "培训计划", "案例");

    /**
     * 「预计完成时间取值字段」（需求 13.9.2 第 4 项）：只读展示项，不落库。
     *
     * <p>不落库的理由是它<b>不是配置</b>：每类对象的哪个字段算「预计完成时间」由需求 13.4.3
     * 固定给出，改它等于改灯色计算的取数逻辑，不是运营能在页面上调的东西。
     * 落一列可编辑的字段名，等于给了一个能把灯色算错的开关。
     */
    public String expectFinishFieldLabel() {
        return switch (objectType) {
            case "AI需求" -> "预计开发完成时间";
            case "课程" -> "预计发布时间";
            case "培训计划" -> "计划结束日期";
            case "案例" -> "预计上架时间";
            default -> "—";
        };
    }
}
