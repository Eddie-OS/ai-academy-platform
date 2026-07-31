package com.aiacademy.app;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.core.Ordered;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * AI学院联合作战平台 · 一期启动类。
 *
 * <p>模块化单体（《开发实施文档》4.1）：单实例、单库、本地事务，不拆微服务。
 * 定时任务用 Spring Scheduling，单实例部署故不引 ShedLock（3.2）。
 *
 * <p><b>{@code @EnableTransactionManagement(order = HIGHEST_PRECEDENCE)} 不是可选项。</b>
 * Spring 默认把事务通知放在最内层（{@code LOWEST_PRECEDENCE}），于是其他切面都在事务<b>外面</b>执行。
 * 审计日志切面（{@code OpLogAspect}）一旦落在事务外，就会出现「业务改动已提交、日志写失败」，
 * 而需求 16.1.3 要求的恰恰相反：日志写失败必须让业务回滚（开发 5.2.3 坑二）。把事务提到最外层，
 * 切面里的日志写入就与业务改动同生共死。
 */
@SpringBootApplication(scanBasePackages = "com.aiacademy")
@ConfigurationPropertiesScan(basePackages = "com.aiacademy")
@MapperScan("com.aiacademy.**.repository")
@EnableTransactionManagement(order = Ordered.HIGHEST_PRECEDENCE)
@EnableScheduling
public class AiAcademyApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiAcademyApplication.class, args);
    }
}
