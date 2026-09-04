package com.aiacademy.app.support;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.DatabasePopulatorUtils;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;

/**
 * 演示数据装载（由 {@code aiacademy.demo-data.enabled} 开关控制，local 与单机交付模式都会开）。
 *
 * <p>解决的是一个具体的坏体验：从 GitHub 克隆下来的库<b>只有表结构没有业务数据</b>
 * （49 个迁移脚本里只有字典、阈值、自检项、派生规则四类配置种子）。而前端在库为空时
 * 会退回 {@code src/fixtures} 的冻结数据，于是讲师池显示 60 张卡、顶部指标卡显示 0 ——
 * 一个页面上两个数据源。那 60 张卡还没有数据库主键，点编辑只会弹「演示数据无法保存」。
 *
 * <h2>为什么不是 Flyway 迁移</h2>
 *
 * <p>{@code application.yml} 里 {@code validate-on-migrate: true} 且只配了一个 location。
 * 种子一旦记进 {@code flyway_schema_history}，之后谁用 prod profile 连同一个库，
 * 都会因为「已应用的迁移在本地解析不到」而启动失败。而演示数据本来也不该进生产库。
 *
 * <h2>为什么只在整套业务表都空的时候灌</h2>
 *
 * <p>种子里的 INSERT 带显式主键，任何一张表有残留行都可能撞主键。更重要的是要让
 * <b>「用户删掉的记录不在下次启动时复活」</b>：界面上的删除是 SEC2 逻辑删除，
 * 把 {@code deleted} 置真而行仍留在表里，所以下面的计数<b>刻意不加</b>
 * {@code WHERE deleted = false} —— 删过的库在这里仍然算「非空」，不会被再灌一次。
 */
/*
 * 开关从 profile 改成显式属性（aiacademy.demo-data.enabled）。
 *
 * 原先是 @Profile("local")，于是单机交付模式（prod,standalone）不会装载演示数据，
 * 内网新装一台机器打开就是空库——而空库正是「讲师池 60 张卡、顶部指标显示 0」那一类
 * 现象的源头。用属性而不是再加一个 profile，是因为「要不要演示数据」与「跑在哪个环境」
 * 是两件独立的事：同一台内网机器，演示时要数据，正式录入前要清空。
 *
 * matchIfMissing = false：没写这个属性就不装。两处显式打开——application-local.yml 与
 * application-standalone.yml。默认关掉是因为「往库里灌 598 行数据」不该是省略配置时的行为。
 */
@Component
@ConditionalOnProperty(name = "aiacademy.demo-data.enabled", havingValue = "true")
public class DemoDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private static final String SEED_SCRIPT = "db/demo/demo-data.sql";

    /**
     * 判空用的表清单，与种子脚本导出的那 19 张一致。
     *
     * <p>少写一张的后果不是报错：那张表留着上一轮的行，而其余 18 张被重新灌一遍，
     * 于是库里出现一份对不上的数据。
     */
    private static final String[] SEEDED_TABLES = {
            "org_employee", "biz_demand", "biz_course", "biz_lecturer", "biz_case",
            "biz_training_plan", "biz_training_session", "rel_demand_course",
            "dtl_demand_review", "dtl_demand_acceptance", "dtl_course_material_version",
            "dtl_attendance", "dtl_training_archive",
            "dtl_case_view", "dtl_case_like", "dtl_case_comment", "dtl_escalation_record",
            "audit_state_log", "sys_task",
    };

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public DemoDataSeeder(DataSource dataSource, JdbcTemplate jdbc, PlatformTransactionManager txManager) {
        this.dataSource = dataSource;
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(txManager);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seedIfEmpty() {
        try {
            doSeed();
        } catch (RuntimeException e) {
            /*
             * 装载失败不该把整个应用拖住：这是本地开发的便利设施，不是启动的前置条件。
             *
             * 早先没有这层 catch，异常直接从 ApplicationReadyEvent 冒出去。真出过一次：
             * pg_dump 生成的脚本里带一句 set_config('search_path', '', false)，会话级地
             * 清空了 search_path，那条连接回到池子后，紧接着用于打日志的计数就报
             * 「relation "org_employee" does not exist」——数据其实已经提交了，坏的只是
             * 那句日志，但后端整体启动失败。「有没有演示数据」不该升级成「后端跑不起来」。
             */
            log.error("本地演示数据装载失败，应用继续启动。库里现在可能是空的或只有一半，"
                    + "排查后可用 docker compose -f docker-compose.local.yml down -v 重建库再试", e);
        }
    }

    private void doSeed() {
        long existing = countExistingRows();
        if (existing > 0) {
            log.info("本地演示数据：库里已有 {} 行业务数据，跳过装载", existing);
            return;
        }

        ClassPathResource script = new ClassPathResource(SEED_SCRIPT);
        if (!script.exists()) {
            log.warn("本地演示数据：找不到 {}，跳过装载", SEED_SCRIPT);
            return;
        }

        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(script);
        // 半灌的库比空库更难处理：它非空，所以下次启动不会重灌，人却只看到一半的数据
        populator.setContinueOnError(false);

        /*
         * 整份脚本在一个事务里跑。脚本首尾的 SET session_replication_role 是会话级的，
         * ResourceDatabasePopulator 全程用同一个连接，所以关外键触发器这件事覆盖得到所有 INSERT。
         */
        tx.executeWithoutResult(status -> DatabasePopulatorUtils.execute(populator, dataSource));

        log.info("本地演示数据：已装载 {} 行。在界面上删除后不会再自动灌回来", countExistingRows());
    }

    private long countExistingRows() {
        StringBuilder sql = new StringBuilder("SELECT ");
        for (int i = 0; i < SEEDED_TABLES.length; i++) {
            sql.append(i == 0 ? "" : " + ")
               .append("(SELECT count(*) FROM ").append(SEEDED_TABLES[i]).append(")");
        }
        Long total = jdbc.queryForObject(sql.toString(), Long.class);
        return total == null ? 0L : total;
    }
}
