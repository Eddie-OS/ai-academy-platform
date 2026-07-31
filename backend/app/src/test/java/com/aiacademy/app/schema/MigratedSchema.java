package com.aiacademy.app.schema;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.aiacademy.app.support.PostgresContainer;
import org.flywaydb.core.Flyway;

/**
 * 在真实 PostgreSQL 上跑一遍全部 Flyway 迁移，并把结果 schema 读成内存结构供断言。
 *
 * <p>容器来自 {@link PostgresContainer}（全 JVM 共用一个）。迁移在本类初始化时跑一次：
 * 44 张表不到一秒。Spring 集成测试启动时 Flyway 会再跑一次，那时全部脚本已是「已应用」状态，
 * 不会重复建表。
 */
final class MigratedSchema {

    private static final String JDBC_URL;
    private static final String USERNAME;
    private static final String PASSWORD;

    /** 表名 → 列名集合。 */
    private static final Map<String, Set<String>> COLUMNS;
    /** 列的 information_schema.data_type，键为 {@code 表名.列名}。 */
    private static final Map<String, String> COLUMN_TYPES;

    static {
        JDBC_URL = PostgresContainer.jdbcUrl();
        USERNAME = PostgresContainer.username();
        PASSWORD = PostgresContainer.password();

        // 用 url/user/password 而不是 DataSource 对象：PostgreSQL 驱动在本模块是 runtimeOnly，
        // 测试编译期看不到 PGSimpleDataSource。为一个测试基座把驱动提到编译期依赖不值得。
        Flyway.configure()
                .dataSource(JDBC_URL, USERNAME, PASSWORD)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        COLUMNS = new LinkedHashMap<>();
        COLUMN_TYPES = new LinkedHashMap<>();
        loadColumns();
    }

    private MigratedSchema() {
    }

    private static Connection connect() throws SQLException {
        return DriverManager.getConnection(JDBC_URL, USERNAME, PASSWORD);
    }

    private static void loadColumns() {
        String sql = """
                SELECT c.table_name, c.column_name, c.data_type
                FROM information_schema.columns c
                JOIN information_schema.tables t
                  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
                WHERE c.table_schema = 'public'
                  AND t.table_type = 'BASE TABLE'
                  AND c.table_name <> 'flyway_schema_history'
                ORDER BY c.table_name, c.ordinal_position
                """;
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String table = rs.getString(1);
                String column = rs.getString(2);
                COLUMNS.computeIfAbsent(table, k -> new LinkedHashSet<>()).add(column);
                COLUMN_TYPES.put(table + "." + column, rs.getString(3));
            }
        } catch (SQLException e) {
            throw new IllegalStateException("读取迁移后的 schema 失败", e);
        }
    }

    static Set<String> tableNames() {
        return COLUMNS.keySet();
    }

    static Set<String> columnsOf(String table) {
        return COLUMNS.getOrDefault(table, Set.of());
    }

    static boolean hasColumn(String table, String column) {
        return columnsOf(table).contains(column);
    }

    static String dataTypeOf(String table, String column) {
        return COLUMN_TYPES.get(table + "." + column);
    }

    /** 含有指定列的全部表。用于「version 只许出现在三张表上」这类范围断言。 */
    static List<String> tablesHavingColumn(String column) {
        List<String> result = new ArrayList<>();
        COLUMNS.forEach((table, columns) -> {
            if (columns.contains(column)) {
                result.add(table);
            }
        });
        return result;
    }

    static List<String> query(String sql) {
        List<String> rows = new ArrayList<>();
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            int columnCount = rs.getMetaData().getColumnCount();
            while (rs.next()) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= columnCount; i++) {
                    if (i > 1) {
                        row.append(" | ");
                    }
                    row.append(rs.getString(i));
                }
                rows.add(row.toString());
            }
        } catch (SQLException e) {
            throw new IllegalStateException("查询失败：" + sql, e);
        }
        return rows;
    }
}
