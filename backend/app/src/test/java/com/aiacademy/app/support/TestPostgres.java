package com.aiacademy.app.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

/**
 * 整个测试 JVM 共用的一个真实 PostgreSQL 实例。
 *
 * <p><b>为什么不用 H2 一类的内存库：</b>建库脚本用了生成列、部分索引、{@code GIN + pg_trgm}、
 * {@code JSONB}、{@code TIMESTAMPTZ}、{@code FOR UPDATE} 行锁，三色灯 {@code calc_light} 还是
 * 一个 plpgsql 存储函数（开发 3.3）。在别的库上跑通，不能说明生产能跑通。
 *
 * <p><b>为什么从 Testcontainers 换成嵌入式：</b>Testcontainers 要 Docker，而部署目标是装不了
 * Docker 的内网机器。测试与生产用同一套二进制交付方式（见
 * {@link com.aiacademy.app.support.EmbeddedPostgresBootstrap}），才谈得上「测的是生产那条路」。
 * 换掉的只是拿到 PostgreSQL 的方式，<b>版本仍是 15，SQL 一行没改</b>。
 *
 * <p><b>为什么共用一个实例：</b>起一次约 3～10 秒（首次要解包二进制），而全部集成测试对数据库的
 * 要求完全相同。每个测试类各起一个会让这一组测试从十几秒变成好几分钟。实例随 JVM 退出，
 * postmaster 由 {@code EmbeddedPostgres} 注册的钩子回收。
 */
public final class TestPostgres {

    private static final EmbeddedPostgres INSTANCE = start();

    /** zonky 的默认超级用户与默认库，initdb 建的是 trust 认证，因此没有口令。 */
    private static final String USER = "postgres";
    private static final String DATABASE = "postgres";

    private TestPostgres() {
    }

    private static EmbeddedPostgres start() {
        try {
            Path dataDir = Files.createTempDirectory("aiacademy-test-pg");
            return EmbeddedPostgres.builder()
                    // 不指定端口：由 zonky 挑一个空闲端口。写死端口会与单机模式那个实例
                    // （15432）或本机已装的 PostgreSQL 撞上，而并行跑两个测试 JVM 时必然互相踩
                    .setDataDirectory(dataDir)
                    // 测试要的是每次全新的库，与单机模式相反（那边必须持久化）
                    .setCleanDataDirectory(true)
                    /*
                     * 编码与生产逐字对齐（docker-compose 的 --encoding=UTF8 --locale=C，
                     * 单机模式见 EmbeddedPostgresBootstrap）。
                     *
                     * 不指定时 initdb 按操作系统区域猜，Windows 中文环境会建成 GBK 一类。
                     * 全库枚举值都是中文，编码不一致时测试会以一种极难归因的方式变绿或变红：
                     * 中文字符串比较在两种编码下的排序与长度都不同，而失败信息只会说
                     * 「期望『在职』实际『在职』」。
                     */
                    .setLocaleConfig("encoding", "UTF8")
                    .setLocaleConfig("locale", "C")
                    // 首次运行要把二进制解包到用户目录，杀毒软件实时扫描下会明显变慢
                    .setPGStartupWait(Duration.ofSeconds(120))
                    .start();
        } catch (IOException e) {
            throw new UncheckedIOException("测试用嵌入式 PostgreSQL 启动失败", e);
        }
    }

    public static String jdbcUrl() {
        return INSTANCE.getJdbcUrl(USER, DATABASE);
    }

    public static String username() {
        return USER;
    }

    public static String password() {
        return "";
    }
}
