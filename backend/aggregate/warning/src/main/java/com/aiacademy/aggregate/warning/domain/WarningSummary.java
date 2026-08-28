package com.aiacademy.aggregate.warning.domain;

/**
 * 总看板 C 区三色灯汇总（需求 7.5；灯色口径 V-9）。
 *
 * <p>{@code blue} = 正常运行（健康态）。{@code healthy} 与 {@code blue} 同值，
 * 留给仍读 healthy 字段的客户端；预警区不再单独展示第四张「健康对象数」卡。
 * {@code yellow} = 需要关注；{@code red} = 已逾期或状态停滞。
 */
public record WarningSummary(long healthy, long blue, long yellow, long red) {
}
