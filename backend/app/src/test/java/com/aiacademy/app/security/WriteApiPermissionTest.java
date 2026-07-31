package com.aiacademy.app.security;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.AccountType;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.common.security.WriteAudience;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.handler;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 出口准则 E1-5 的运行时一半：注解真的被执行，漏注解真的被拒。
 *
 * <p>{@code ArchitectureRulesTest} 用 ArchUnit 静态断言「写接口都带 @WriteApi」，那是构建期门禁。
 * 但静态断言管不到两件事：注解是否真的参与了判定，以及漏注解时运行时的行为。
 * 一条只在编译期成立的规则很容易变成装饰——注解贴满了，拦截器却从来没读它。
 */
@AutoConfigureMockMvc
// 父类的 @SpringBootTest 显式给了 classes，嵌套 @TestConfiguration 不会被默认探测，必须显式 @Import
@Import(WriteApiPermissionTest.TestEndpoints.class)
class WriteApiPermissionTest extends IntegrationTest {

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    @Autowired
    private MockMvc mvc;

    /** actuator 也注册了一个 RequestMappingHandlerMapping，按名字取业务的那个。 */
    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("E1-5：Spring 实际注册的每个写接口都带 @WriteApi——静态扫描之外再从容器确认一遍")
    void 已注册的写接口全部带注解() {
        Map<String, String> missing = new TreeMap<>();
        int checked = 0;

        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry
                : handlerMapping.getHandlerMethods().entrySet()) {
            HandlerMethod handler = entry.getValue();
            if (!isWriteMapping(entry.getKey()) || !isProjectController(handler)) {
                continue;
            }
            // 本测试自己注册的漏注解接口是被测对象，不是违规项
            if (handler.getBeanType() == TestEndpoints.WriteEndpoints.class) {
                continue;
            }
            checked++;
            if (handler.getMethodAnnotation(WriteApi.class) == null) {
                missing.put(entry.getKey().toString(), handler.getMethod().toString());
            }
        }

        assertThat(missing)
                .describedAs("这些写接口没有声明开放范围，运行时会被 PermissionInterceptor 拒绝")
                .isEmpty();
        assertThat(checked)
                .describedAs("一个写接口都没扫到，说明这条断言在空转——比漏注解更危险")
                .isGreaterThanOrEqualTo(10);
    }

    @Test
    @DisplayName("默认拒绝（PMI-1）：漏注解的写接口连运营账号都调不通，不会「碰巧能用」")
    void 漏注解的写接口一律拒绝() throws Exception {
        mvc.perform(as运营(post("/api/test-support/unannotated-write")))
                // 断言路由真的落到了那个方法上：不加这一条，路径写错也会得到同样的 403
                // （未匹配的 /api/** 会落到静态资源处理器，拦截器同样按「不是写接口声明」拒绝）
                .andExpect(handler().methodName("unannotated"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value(containsString("未声明写权限范围")));
    }

    @Test
    @DisplayName("注解真的在参与判定：只差注解取值的两个接口，查看账号一个能写一个被拒")
    void 用户可写档位真的放行() throws Exception {
        mvc.perform(as查看(post("/api/test-support/user-allowed-write")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"));

        mvc.perform(as查看(post("/api/test-support/operator-only-write")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("PMI-2：读接口无差别开放，查看账号读导入批次、人员台账、配置中心都是 200")
    void 读接口对两个账号一致() throws Exception {
        for (String path : List.of("/api/imports", "/api/employees", "/api/config/thresholds",
                "/api/config/dicts/作战单元/items", "/api/config/selfcheck-items",
                "/api/config/task-derive-rules", "/api/meta/enums", "/api/meta/dicts")) {
            mvc.perform(as查看(get(path)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value("OK"));
        }
    }

    @Test
    @DisplayName("PMI-4：判权与数据归属无关——运营删掉「别人」创建的附件必须成功")
    void 写入不看数据归属() throws Exception {
        // 完整版的这条测试要等阶段 2 的对象编辑接口（运营改一个 owner_no 指向他人的需求）。
        // 一期能表达同一件事的最近路径是附件：这一行的 created_by 不是当前账号，删除照样成功。
        Long id = jdbc.queryForObject("""
                INSERT INTO sys_attachment (file_name, file_size, content_type, storage_path,
                                            sha256, created_by)
                VALUES ('别人上传的.png', 3, 'image/png', 'general/202607/other.png', NULL, '另一个运营')
                RETURNING id
                """, Long.class);

        mvc.perform(as运营(delete("/api/attachments/{id}", id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"));

        assertThat(jdbc.queryForObject(
                "SELECT deleted FROM sys_attachment WHERE id = ?", Boolean.class, id))
                .describedAs("运营删不掉别人创建的数据，说明有人把 created_by 当成了判权依据（PMI-4）")
                .isTrue();
    }

    // -------------------------------------------------------------------------

    private boolean isWriteMapping(RequestMappingInfo info) {
        return info.getMethodsCondition().getMethods().stream()
                .anyMatch(method -> WRITE_METHODS.contains(method.name()));
    }

    /** Spring Boot 自带的 error 端点与 actuator、springdoc 不在 E1-5 的范围里。 */
    private boolean isProjectController(HandlerMethod handler) {
        return handler.getBeanType().getName().startsWith("com.aiacademy");
    }

    private MockHttpServletRequestBuilder as运营(MockHttpServletRequestBuilder builder) {
        return builder.with(csrf()).with(user("operator")
                .authorities(new SimpleGrantedAuthority(AccountType.OPERATOR.authority())));
    }

    private MockHttpServletRequestBuilder as查看(MockHttpServletRequestBuilder builder) {
        return builder.with(csrf()).with(user("viewer")
                .authorities(new SimpleGrantedAuthority(AccountType.VIEWER.authority())));
    }

    /**
     * 三个只在测试上下文里存在的写接口。放在测试里而不是生产代码里，是因为生产代码里
     * <b>不允许</b>存在漏注解的写接口——E1-5 的静态断言会把它拦下。
     */
    @TestConfiguration
    static class TestEndpoints {

        @RestController
        @RequestMapping("/api/test-support")
        public static class WriteEndpoints {

            @PostMapping("/unannotated-write")
            public R<String> unannotated() {
                return R.ok("不该走到这里");
            }

            @WriteApi
            @PostMapping("/operator-only-write")
            public R<String> operatorOnly() {
                return R.ok("ok");
            }

            @WriteApi(WriteAudience.USER_ALLOWED)
            @PostMapping("/user-allowed-write")
            public R<String> userAllowed() {
                return R.ok("ok");
            }
        }
    }
}
