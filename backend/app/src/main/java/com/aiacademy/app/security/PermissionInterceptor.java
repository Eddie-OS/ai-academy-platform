package com.aiacademy.app.security;

import com.aiacademy.common.exception.ForbiddenException;
import com.aiacademy.common.security.AccountType;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.common.security.WriteAudience;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Optional;

/**
 * 全项目<b>唯一</b>的判权位置（规则 AR-7、PMI-4），对应《开发实施文档》5.3。
 *
 * <p>判定式（需求文档 6.2 规则 PM1）：
 * <pre>允许写入 = 当前账号类型 == 运营账号</pre>
 *
 * <p><b>这个判定式是无状态的</b>：不加载对象、不查库、不看当前状态、<b>不读 owner_no</b>。
 * 需求文档 V1.2 已明确负责人字段保留但不再参与判权（术语表、事实 9）。
 *
 * <p>开放范围由接口自己用 {@link WriteApi} 声明（出口准则 E1-5），本类只负责执行：
 * <ul>
 *   <li>读方法（GET／HEAD／OPTIONS）一律放行——一期读权限完全无差异（纪律 PMI-2）；
 *   <li>写方法按注解判定；
 *   <li><b>没有注解的写方法一律拒绝</b>（纪律 PMI-1「默认拒绝」）。
 * </ul>
 *
 * <p>漏注解时打 ERROR 而不是静默放行：那是代码缺陷，要在日志里留下痕迹，
 * 否则「忘了声明」会以「运营能用、用户不能用」的形式表现为正常，直到有人需要开放它才发现。
 */
@Component
public class PermissionInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(PermissionInterceptor.class);

    private final CurrentAccount currentAccount;

    public PermissionInterceptor(CurrentAccount currentAccount) {
        this.currentAccount = currentAccount;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (isReadOnlyMethod(request.getMethod())) {
            return true;
        }

        WriteAudience audience = audienceOf(handler, request);
        if (audience == null) {
            throw new ForbiddenException("该接口未声明写权限范围，已被拒绝。这是代码缺陷，请联系管理员");
        }
        if (audience == WriteAudience.ANONYMOUS) {
            return true;
        }

        Optional<AccountType> account = currentAccount.find();
        if (account.isEmpty()) {
            // 到这里说明 SecurityConfig 放行了一个需要登录的写接口，属于配置错误
            throw new ForbiddenException("请先登录后再执行该操作");
        }
        if (account.get().isOperator()) {
            return true;
        }
        if (audience == WriteAudience.USER_ALLOWED) {
            return true;
        }
        throw new ForbiddenException("用户账号为只读账号，仅可点赞与评论；该操作需要运营账号");
    }

    /**
     * 取接口声明的开放范围，漏注解返回 {@code null}（调用方据此拒绝）。
     *
     * <p>漏注解拒绝而不是「按仅运营处理」：后者能跑通运营的全部操作，于是漏注解在开发与自测中
     * 完全看不出来，等到有人要把接口开放给用户账号时才发现从没声明过。拒绝掉则第一次调用就暴露。
     * 它不会漏到生产：E1-5 的 ArchUnit 断言在构建期就会红。
     */
    private WriteAudience audienceOf(Object handler, HttpServletRequest request) {
        if (!(handler instanceof HandlerMethod method)) {
            // 静态资源等非 @RequestMapping 处理器不该出现在 /api/** 下
            return null;
        }
        WriteApi annotation = method.getMethodAnnotation(WriteApi.class);
        if (annotation == null) {
            log.error("写接口 {} {} 缺少 @WriteApi 注解（出口准则 E1-5），已拒绝。处理方法：{}",
                    request.getMethod(), request.getRequestURI(), method.getMethod());
            return null;
        }
        return annotation.value();
    }

    private boolean isReadOnlyMethod(String method) {
        return HttpMethod.GET.matches(method)
                || HttpMethod.HEAD.matches(method)
                || HttpMethod.OPTIONS.matches(method);
    }
}
