package com.aiacademy.app.config;

import com.aiacademy.app.security.PermissionInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 全部 {@code /api} 请求经过权限拦截器。
 *
 * <p>纪律 PMI-1：不允许为某个 Controller 单独排除拦截；需要放行的接口在
 * {@link PermissionInterceptor} 内的白名单集合中声明，白名单是可被审计的一处。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final PermissionInterceptor permissionInterceptor;

    public WebMvcConfig(PermissionInterceptor permissionInterceptor) {
        this.permissionInterceptor = permissionInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(permissionInterceptor).addPathPatterns("/api/**");
    }
}
