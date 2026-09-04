package com.aiacademy.app.support;

import com.aiacademy.app.AiAcademyApplication;
import java.util.UUID;
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

    /**
     * 测试期两个共享账号的口令，每次 JVM 启动随机生成。
     *
     * <p>刻意不写进 {@code application-test.yml}：<b>仓库里不留任何看起来能用的口令字符串</b>。
     * 从 GitHub 下载本项目的人不该在任何文件里读到一个像口令的东西——即便它「只是测试用」，
     * 也会被顺手复制到别处，而复制的人不会知道它只该用于测试。
     *
     * <p>需要明文口令的测试从这里取，不要自己写字面量：写死的字面量与配置一旦不同步，
     * 失败信息是「登录失败」，看不出是配置漂了。
     */
    public static final String OPERATOR_PASSWORD = UUID.randomUUID().toString();

    /** 用户账号的测试口令，理由同 {@link #OPERATOR_PASSWORD}。 */
    public static final String VIEWER_PASSWORD = UUID.randomUUID().toString();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", TestPostgres::jdbcUrl);
        registry.add("spring.datasource.username", TestPostgres::username);
        registry.add("spring.datasource.password", TestPostgres::password);

        // 用 {noop} 而不是 {bcrypt}：SharedAccountCredentialsCheck 只在 prod profile 生效，
        // 这里是 test profile，没有它把关。而 bcrypt 的代价因子会给每个测试类多加一次
        // 刻意设计成慢的哈希计算，635 个用例累积起来不划算。
        registry.add("aiacademy.accounts.operator.password-hash", () -> "{noop}" + OPERATOR_PASSWORD);
        registry.add("aiacademy.accounts.viewer.password-hash", () -> "{noop}" + VIEWER_PASSWORD);
    }
}
