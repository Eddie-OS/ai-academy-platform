package com.aiacademy.app;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * AI学院联合作战平台 · 一期启动类。
 *
 * <p>模块化单体（《开发实施文档》4.1）：单实例、单库、本地事务，不拆微服务。
 * 定时任务用 Spring Scheduling，单实例部署故不引 ShedLock（3.2）。
 */
@SpringBootApplication(scanBasePackages = "com.aiacademy")
@ConfigurationPropertiesScan(basePackages = "com.aiacademy")
@MapperScan("com.aiacademy.**.repository")
@EnableScheduling
public class AiAcademyApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiAcademyApplication.class, args);
    }
}
