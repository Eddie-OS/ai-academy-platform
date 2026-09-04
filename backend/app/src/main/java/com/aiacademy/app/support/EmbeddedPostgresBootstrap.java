package com.aiacademy.app.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.apache.commons.logging.Log;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.logging.DeferredLogFactory;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 单机模式的嵌入式 PostgreSQL（standalone profile）。
 *
 * <p>解决的是一个部署约束：<b>内网机器装不了 Docker</b>。而本项目的 SQL 深度依赖 PostgreSQL
 * 专有能力——三色灯 {@code calc_light} 是 plpgsql 存储函数、79 个带 {@code WHERE} 的部分索引、
 * {@code GIN + pg_trgm}、132 处 {@code TIMESTAMPTZ}、35 处 {@code jsonb}——换 SQLite 等于
 * 重写数据层与三色灯引擎，且在别的库上跑通证明不了生产能跑通（开发 3.3、宪法第二节
 * 「刻意使用专有语法、不做数据库隔离」）。
 *
 * <p>所以这里换的不是数据库，只是<b>同一个 PostgreSQL 的交付方式</b>：官方 PG 15 二进制打在
 * jar 里，启动时解包到本地目录并拉起一个真实的 postmaster 进程。不需要 Docker、不需要安装、
 * 不需要管理员权限，49 个迁移脚本与 54 个指标 SQL 一行都不用改。
 *
 * <h2>为什么是 EnvironmentPostProcessor 而不是 @Bean 或 main()</h2>
 *
 * <p>数据库必须在 {@code DataSource} 之前就绪，而 {@code DataSource} 是 Spring 启动早期就会被
 * 创建的基础设施 Bean（Flyway 紧接着就要用它跑迁移）。用 {@code @Bean} 依赖顺序难保证，
 * 写在 {@code main()} 里则读不到 yml 配置——那时 Environment 还不存在，只能靠解析命令行参数，
 * 于是「配置放哪」会分裂成两处。
 *
 * <p>{@code EnvironmentPostProcessor} 恰好在 Environment 装配完成之后、任何 Bean 创建之前运行，
 * 既能读到 {@code application-standalone.yml}，又赶在 DataSource 之前。
 *
 * <p><b>{@link #getOrder()} 返回 {@code LOWEST_PRECEDENCE} 不是随手写的。</b>加载
 * {@code application-*.yml} 的 {@code ConfigDataEnvironmentPostProcessor} 自己也是一个
 * EnvironmentPostProcessor，序号是 {@code HIGHEST_PRECEDENCE + 10}。如果本类排在它前面，
 * {@code aiacademy.embedded-db.enabled} 就读不到——而读不到的表现<b>不是报错，是这个类安静地
 * 什么都不做</b>，然后应用去连一个并不存在的 5432 端口，报「Connection refused」。
 * 那个错误信息不会有任何一处提到嵌入式数据库没启动。
 */
public class EmbeddedPostgresBootstrap implements EnvironmentPostProcessor, Ordered {

    /** 开关。只在 {@code application-standalone.yml} 里置真，默认关——生产连外部 PG 的那条路不受影响。 */
    private static final String ENABLED = "aiacademy.embedded-db.enabled";

    private static final String PORT = "aiacademy.embedded-db.port";
    private static final String DATA_DIR = "aiacademy.embedded-db.data-dir";

    /**
     * 默认端口刻意不用 5432。
     *
     * <p>5432 上很可能已经有东西：本机装过的 PostgreSQL 服务、或者 docker-compose.local.yml
     * 映射出来的那个容器。撞端口时嵌入式实例起不来，而更坏的情况是它没起来、应用却连上了
     * 那个<b>不相干的库</b>，Flyway 在别人的库上开始建表。
     */
    private static final int DEFAULT_PORT = 15432;

    private static final String DEFAULT_DATA_DIR = "data/pgdata";

    /** 内置实例的库名与账号。zonky 的默认超级用户就是 postgres，不另建角色——少一个能出错的环节。 */
    private static final String DB_USER = "postgres";
    private static final String DB_NAME = "postgres";

    /**
     * 持有实例的静态引用。
     *
     * <p>两个作用：一是防止被 GC（回收会带走 postmaster 进程）；二是幂等——
     * Spring Boot 在某些场景（如 {@code spring-boot-devtools} 重启、测试上下文重建）会重复
     * 走一遍环境装配，第二次再起一个 postmaster 会直接撞端口。
     */
    private static volatile EmbeddedPostgres instance;

    private final Log log;

    public EmbeddedPostgresBootstrap(DeferredLogFactory logFactory) {
        // EnvironmentPostProcessor 跑在日志系统初始化之前，普通 Logger 的输出会丢。
        // DeferredLogFactory 把日志攒起来，等日志系统就绪后重放——否则下面那句
        // 「数据目录在哪」永远看不到，而它恰恰是这套机制最需要说清的一件事。
        this.log = logFactory.getLog(EmbeddedPostgresBootstrap.class);
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!environment.getProperty(ENABLED, Boolean.class, false)) {
            return;
        }
        if (instance != null) {
            log.info("嵌入式 PostgreSQL 已在运行（端口 " + instance.getPort() + "），跳过重复启动");
            applyDataSourceProperties(environment, instance.getPort());
            return;
        }

        int port = environment.getProperty(PORT, Integer.class, DEFAULT_PORT);
        Path dataDir = resolveDataDir(environment.getProperty(DATA_DIR, DEFAULT_DATA_DIR));

        log.info("正在启动嵌入式 PostgreSQL：端口 " + port + "，数据目录 " + dataDir);
        boolean firstRun = !Files.exists(dataDir.resolve("PG_VERSION"));

        try {
            instance = EmbeddedPostgres.builder()
                    .setPort(port)
                    .setDataDirectory(dataDir)
                    // 数据必须活过重启。默认值是 true（跑完就删），那是给测试用的：
                    // 保留默认会让运营录入的数据在下次启动时消失，而界面上没有任何迹象
                    .setCleanDataDirectory(false)
                    /*
                     * 建库编码必须显式指定，与 docker-compose.local.yml 的
                     * POSTGRES_INITDB_ARGS: '--encoding=UTF8 --locale=C' 逐字对齐。
                     *
                     * 不指定时 initdb 按操作系统区域设置猜，Windows 中文环境下会建成 GBK
                     * 一类的编码。后果在阶段 0 踩过一次：`在职` 被替换成 `??` 并真的以 0x3F3F
                     * 存进数据库，用 encode(convert_to(...),'UTF8'),'hex') 才查得出来。
                     * 全库枚举值都是中文（宪法第三节），编码错一次等于数据全废，
                     * 而且是在写入时静默损坏，读出来才发现。
                     */
                    .setLocaleConfig("encoding", "UTF8")
                    .setLocaleConfig("locale", "C")
                    // 单机 100 人以内，连接数给足即可；与 docker-compose 生产配置同量级
                    .setServerConfig("max_connections", "100")
                    .setServerConfig("timezone", "Asia/Shanghai")
                    // 首次启动要 initdb（解包 + 建库），比后续启动慢得多。默认 10 秒在
                    // 机械盘或杀毒软件实时扫描下不够，超时会让人以为「装不上」
                    .setPGStartupWait(Duration.ofSeconds(firstRun ? 120 : 60))
                    .start();
        } catch (IOException e) {
            throw new UncheckedIOException(
                    "嵌入式 PostgreSQL 启动失败。数据目录 " + dataDir + "，端口 " + port
                            + "。常见原因：端口被占用（用 aiacademy.embedded-db.port 换一个）、"
                            + "数据目录所在盘符不存在或无写权限、"
                            + "上次进程被强杀后残留 postmaster.pid（删掉该文件再试）", e);
        }

        Runtime.getRuntime().addShutdownHook(new Thread(EmbeddedPostgresBootstrap::stop, "embedded-pg-shutdown"));

        applyDataSourceProperties(environment, instance.getPort());
        // 这句话里不要出现「已完成」等状态机里的状态值：StateLiteralGuardTest（E2-6）
        // 按子串扫描源码，日志文案里凑巧出现状态值会让那道守卫报红
        log.info("嵌入式 PostgreSQL 已就绪：" + instance.getJdbcUrl(DB_USER, DB_NAME)
                + (firstRun ? "（首次启动，建库完毕）" : ""));
    }

    /**
     * 把连接参数塞到最高优先级的属性源。
     *
     * <p>用 {@code addFirst} 而不是 {@code addLast}：{@code application-standalone.yml} 里
     * 那份 {@code spring.datasource.*} 是给「看配置的人」读的说明，真实端口由本类决定
     * （端口可被配置覆盖，URL 必须跟着变）。两处不一致时必须以这里为准，
     * 否则会连到一个并不存在的地址。
     */
    private void applyDataSourceProperties(ConfigurableEnvironment environment, int port) {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("spring.datasource.url",
                "jdbc:postgresql://localhost:" + port + "/" + DB_NAME);
        props.put("spring.datasource.username", DB_USER);
        // 嵌入式实例只监听 localhost 且由本进程独占，initdb 建的是 trust 认证，没有口令可言。
        // 这不违反「仓库里不留口令」——它不是一个口令，而是「此处无需口令」
        props.put("spring.datasource.password", "");
        props.put("spring.datasource.driver-class-name", "org.postgresql.Driver");
        environment.getPropertySources().addFirst(new MapPropertySource("embeddedPostgres", props));
    }

    /**
     * 数据目录解析成绝对路径。
     *
     * <p>相对路径会随工作目录变化：{@code java -jar} 从仓库根跑是 {@code <仓库>/data/pgdata}，
     * 而 {@code gradlew :app:bootRun} 的工作目录是 {@code backend/app}，同一份配置指向两个地方。
     * 两个库都能正常建起来，于是<b>「我的数据不见了」表现为一个完全健康的空库</b>。
     * 所以这里转成绝对路径并打进日志，让它指向哪儿这件事是看得见的。
     */
    private static Path resolveDataDir(String configured) {
        Path path = Paths.get(configured).toAbsolutePath().normalize();
        try {
            Files.createDirectories(path);
        } catch (IOException e) {
            throw new UncheckedIOException("无法创建数据目录 " + path, e);
        }
        return path;
    }

    private static void stop() {
        EmbeddedPostgres pg = instance;
        if (pg == null) {
            return;
        }
        instance = null;
        try {
            pg.close();
        } catch (IOException e) {
            // 关不掉不该影响退出码：进程正在结束，postmaster 会随之被系统回收。
            // 下次启动时 PostgreSQL 自己会识别并清掉失效的 postmaster.pid
            System.err.println("嵌入式 PostgreSQL 关闭时报错（不影响退出）：" + e.getMessage());
        }
    }
}
