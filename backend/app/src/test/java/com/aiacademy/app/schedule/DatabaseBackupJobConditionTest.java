package com.aiacademy.app.schedule;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 守住「单机形态不做每日备份」这个决定。
 *
 * <p>为什么要有这条测试：{@link DatabaseBackupJob} 靠外部 {@code pg_dump} 工作，而单机交付包里
 * 没有这个程序（嵌入式 PostgreSQL 只解包 initdb／pg_ctl／postgres）。开着它的效果是每晚
 * 02:00 往日志里抛一次异常，同时让人以为备份已经配好 —— 那比明确没有备份更危险，
 * 因为只有真需要恢复的那天才会发现。
 *
 * <p>「关掉了」这件事没法靠看启动日志确认：这个任务在启动时不打印任何东西，开与关的日志
 * 一模一样。所以只能断言 bean 在不在容器里。
 */
class DatabaseBackupJobConditionTest {

    /** 数据源三个值只是为了满足 {@code @Value} 注入，本测试不连库。 */
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfig.class)
            .withPropertyValues(
                    "spring.datasource.url=jdbc:postgresql://localhost:1/none",
                    "spring.datasource.username=nobody",
                    "spring.datasource.password=");

    @Test
    @DisplayName("aiacademy.backup.enabled=false 时任务不进容器——单机形态就是这么关掉的")
    void 显式关闭() {
        runner.withPropertyValues("aiacademy.backup.enabled=false")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(DatabaseBackupJob.class));
    }

    @Test
    @DisplayName("不配这个开关时任务照旧启用——Docker 形态的既有行为不能被这次改动动到")
    void 默认仍启用() {
        runner.run(ctx -> assertThat(ctx).hasSingleBean(DatabaseBackupJob.class));
    }

    @Test
    @DisplayName("显式写 true 时启用")
    void 显式开启() {
        runner.withPropertyValues("aiacademy.backup.enabled=true")
                .run(ctx -> assertThat(ctx).hasSingleBean(DatabaseBackupJob.class));
    }

    /**
     * 用 {@code @Import} 而不是组件扫描来注册被测任务：{@code @Import} 会照常求值
     * 它类上的 {@code @ConditionalOnProperty}，而扫描不到的类根本谈不上条件生效，
     * 那样三条断言会全绿却什么都没测到。
     */
    @Configuration(proxyBeanMethods = false)
    @Import(DatabaseBackupJob.class)
    static class TestConfig {

        @Bean
        JobRunLogger jobRunLogger() {
            return Mockito.mock(JobRunLogger.class);
        }
    }
}
