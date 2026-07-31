package com.aiacademy.app.security;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.security.AccountType;
import com.aiacademy.common.trace.TraceIdFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/**
 * 安全配置。
 *
 * <p>一期只有两个共享账号（需求文档 6.1、决策 C04），因此这里用 {@link InMemoryUserDetailsManager}
 * 装载配置文件里的两条凭据，<b>不建用户表、角色表、权限表</b>（不做项第 11 条）。
 *
 * <p>登录逻辑约 30 行，不成模块（《开发实施文档》4.2.1 对 people 模块改名的说明）。
 */
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        // 规则 SEC5：生产口令一律 {bcrypt} 前缀的加盐哈希。
        // 用委派编码器是为了让本地开发能用 {noop} 明文口令，同时由
        // SharedAccountCredentialsCheck 保证 {noop} 永远进不了生产。
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(SharedAccountProperties accounts) {
        return new InMemoryUserDetailsManager(
                User.withUsername(accounts.operator().username())
                        .password(accounts.operator().passwordHash())
                        .authorities(AccountType.OPERATOR.authority())
                        .build(),
                User.withUsername(accounts.viewer().username())
                        .password(accounts.viewer().passwordHash())
                        .authorities(AccountType.VIEWER.authority())
                        .build());
    }

    @Bean
    public AuthenticationManager authenticationManager(UserDetailsService userDetailsService,
                                                       PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        // 会话存 JVM 内存，不引 Spring Session（不做项第 18 条）
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   SecurityContextRepository securityContextRepository)
            throws Exception {
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        // 置空后恢复「每次请求都写出 token」，SPA 首个 GET 请求即可拿到 XSRF-TOKEN Cookie
        csrfHandler.setCsrfRequestAttributeName(null);

        http
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/login", "/api/auth/current").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, e) -> {
                    response.setStatus(ErrorCode.UNAUTHENTICATED.httpStatus().value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write(
                            "{\"code\":\"UNAUTHENTICATED\",\"message\":\""
                                    + ErrorCode.UNAUTHENTICATED.defaultMessage()
                                    + "\",\"data\":null,\"traceId\":null}");
                }))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable());

        return http.build();
    }

    @Bean
    public FilterRegistrationBean<TraceIdFilter> traceIdFilter() {
        FilterRegistrationBean<TraceIdFilter> registration = new FilterRegistrationBean<>(new TraceIdFilter());
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/*");
        return registration;
    }

    @Bean
    public FilterRegistrationBean<OperatorContextFilter> operatorContextFilter(CurrentAccount currentAccount) {
        FilterRegistrationBean<OperatorContextFilter> registration =
                new FilterRegistrationBean<>(new OperatorContextFilter(currentAccount));
        // 必须排在 Spring Security 过滤器链（默认 -100）之后，否则 SecurityContext 还没装好，
        // 每个请求都会被记成 SYSTEM 操作。
        registration.setOrder(0);
        registration.addUrlPatterns("/*");
        return registration;
    }
}
