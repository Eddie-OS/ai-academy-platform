package com.aiacademy.app.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.logging.DeferredLogFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 守住 {@link EmbeddedPostgresBootstrap} 的注册方式。
 *
 * <p>这个测试存在的唯一理由是：<b>注册写错时没有任何错误信息。</b>
 *
 * <p>踩过的那一次，注册写成了
 * {@code META-INF/spring/org.springframework.boot.env.EnvironmentPostProcessor.imports}。
 * 那套 {@code .imports} 机制（ImportCandidates）只服务于自动配置，EnvironmentPostProcessor
 * 走的仍是 {@code SpringFactoriesLoader} → {@code META-INF/spring.factories}。
 * 后果是这个类根本不被加载，内嵌数据库不启动，应用转而去连 {@code application-prod.yml} 里
 * 那个默认的 {@code postgres:5432}，最终报：
 *
 * <pre>
 * Unable to obtain connection from database: 尝试连线已失败。
 * </pre>
 *
 * <p>这条报错里没有一处提到嵌入式数据库、profile 或注册文件。日志里连
 * 「正在启动嵌入式 PostgreSQL」都不会出现——因为那行日志在类里，而类没被加载。
 * 排查只能靠拆开 jar 逐个比对 Spring Boot 自己的注册方式。
 *
 * <p>所以这里不做集成测试（起一次真库要一分多钟），只做三条静态断言，跑起来是毫秒级的。
 */
class EmbeddedPostgresBootstrapRegistrationTest {

    private static final String SPRING_FACTORIES = "META-INF/spring.factories";
    private static final String EPP_KEY = EnvironmentPostProcessor.class.getName();

    @Test
    @DisplayName("EmbeddedPostgresBootstrap 注册在 META-INF/spring.factories 里，能被 Spring Boot 发现")
    void 注册在_spring_factories_里() throws IOException {
        assertThat(声明的环境后处理器())
                .as("没有在任何一份 %s 里找到 %s。Spring Boot 只从这里发现 EnvironmentPostProcessor，"
                                + "写成 .imports 不会报错，只会让内嵌数据库静默不启动",
                        SPRING_FACTORIES, EmbeddedPostgresBootstrap.class.getName())
                .contains(EmbeddedPostgresBootstrap.class.getName());
    }

    @Test
    @DisplayName("不存在 .imports 形式的 EnvironmentPostProcessor 注册——那是无效的写法")
    void 没有误用_imports_机制() throws IOException {
        String 错误位置 = "META-INF/spring/" + EPP_KEY + ".imports";

        assertThat(Collections.list(getClass().getClassLoader().getResources(错误位置)))
                .as("classpath 上出现了 %s。这个文件会被完全忽略：EnvironmentPostProcessor 不走 "
                                + ".imports（ImportCandidates 只用于自动配置）。"
                                + "如果它是为了注册 EmbeddedPostgresBootstrap 而加的，删掉它，改写 %s",
                        错误位置, SPRING_FACTORIES)
                .isEmpty();
    }

    @Test
    @DisplayName("构造器签名是 Spring Boot 能注入的那一个（DeferredLogFactory）")
    void 构造器可被容器解析() throws Exception {
        // EnvironmentPostProcessor 跑在日志系统初始化之前，普通 Logger 的输出会丢，
        // 因此这个类要靠 DeferredLogFactory 攒日志。Spring Boot 支持的构造器参数是
        // 一份固定清单（DeferredLogFactory、Log、ConfigurableBootstrapContext 等），
        // 换成清单外的类型会在启动时抛异常——那个是响的，但既然已经在测注册，一起测掉
        var ctor = EmbeddedPostgresBootstrap.class.getConstructor(DeferredLogFactory.class);

        assertThat(ctor).isNotNull();
        assertThat(EnvironmentPostProcessor.class)
                .isAssignableFrom(EmbeddedPostgresBootstrap.class);
    }

    /** 把 classpath 上所有 {@code spring.factories} 里 EnvironmentPostProcessor 那一项的值合起来。 */
    private List<String> 声明的环境后处理器() throws IOException {
        List<String> names = new ArrayList<>();
        for (URL url : Collections.list(getClass().getClassLoader().getResources(SPRING_FACTORIES))) {
            Properties props = new Properties();
            try (InputStream in = url.openStream()) {
                // Properties 原生处理行尾反斜杠续行，与 Spring 自己的解析一致
                props.load(in);
            }
            String value = props.getProperty(EPP_KEY);
            if (value == null) {
                continue;
            }
            for (String name : value.split(",")) {
                if (!name.isBlank()) {
                    names.add(name.trim());
                }
            }
        }
        return names;
    }
}
