package com.aiacademy.app.support;

import com.aiacademy.app.AiAcademyApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * 起真实 Spring 上下文 + 真实 PostgreSQL 的集成测试基类。
 *
 * <p><b>为什么这些测试必须是集成测试而不是单元测试：</b>出口准则 E1-2／E1-3 要验证的正是
 * 「状态写入、流转日志、{@code last_state_changed_at}」三者在<b>同一个事务里</b>成对发生，
 * 以及事务边界与切面顺序是否正确。Mock 掉数据库或事务管理器之后，这几件事全都验证不到——
 * 那样的测试会在实现完全错误时依然通过。
 */
@SpringBootTest(classes = AiAcademyApplication.class)
@ActiveProfiles("test")
public abstract class IntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", PostgresContainer::jdbcUrl);
        registry.add("spring.datasource.username", PostgresContainer::username);
        registry.add("spring.datasource.password", PostgresContainer::password);
    }
}
