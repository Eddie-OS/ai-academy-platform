package com.aiacademy.app.support;

import org.testcontainers.containers.PostgreSQLContainer;

/**
 * 整个测试 JVM 共用的一个 PostgreSQL 容器。
 *
 * <p><b>为什么共用：</b>起容器约 5～10 秒，而建库脚本校验、状态机集成测试、审计日志测试都需要真实
 * PostgreSQL。每个测试类各起一个容器会让这一组测试从十几秒变成一分多钟，而它们对数据库的要求
 * 完全相同。容器随 JVM 退出由 Testcontainers 的 Ryuk 回收，因此不需要显式关闭。
 *
 * <p><b>为什么不用 H2 一类的内存库：</b>建库脚本用了生成列、部分索引、{@code GIN + pg_trgm}、
 * {@code JSONB}、{@code TIMESTAMPTZ}、{@code FOR UPDATE} 行锁，这些都是选 PostgreSQL 的直接理由
 * （开发 3.3）。在别的库上跑通，不能说明生产能跑通。
 */
public final class PostgresContainer {

    private static final PostgreSQLContainer<?> INSTANCE = start();

    private PostgresContainer() {
    }

    private static PostgreSQLContainer<?> start() {
        PostgreSQLContainer<?> container = new PostgreSQLContainer<>("postgres:15-alpine");
        container.start();
        return container;
    }

    public static String jdbcUrl() {
        return INSTANCE.getJdbcUrl();
    }

    public static String username() {
        return INSTANCE.getUsername();
    }

    public static String password() {
        return INSTANCE.getPassword();
    }
}
