package com.aiacademy.app.skeleton.domain;

/**
 * 按状态分组的计数结果。阶段 3 的指标查询会大量使用这类只读投影对象。
 *
 * <p>用 record 承载查询结果需要编译期保留参数名（根 build.gradle.kts 已加 {@code -parameters}），
 * MyBatis 据此做构造器自动映射。
 */
public record SampleStateCount(String sampleState, long total) {
}
