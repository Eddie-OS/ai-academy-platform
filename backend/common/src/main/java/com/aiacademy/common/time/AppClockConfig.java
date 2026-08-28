package com.aiacademy.common.time;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * 可注入时钟，供滚动周期边界等时间敏感逻辑在测试中改系统时间（阶段 4 E4-1）。
 */
@Configuration
public class AppClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
