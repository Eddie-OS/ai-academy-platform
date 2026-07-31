package com.aiacademy.app.security;

import com.aiacademy.common.exception.ForbiddenException;
import com.aiacademy.common.security.AccountType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Optional;
import java.util.Set;

/**
 * 全项目<b>唯一</b>的判权位置（规则 AR-7、PMI-4），对应《开发实施文档》5.3。
 *
 * <p>判定式（需求文档 6.2 规则 PM1）：
 * <pre>允许写入 = 当前账号类型 == 运营账号</pre>
 *
 * <p><b>这个判定式是无状态的</b>：不加载对象、不查库、不看当前状态、<b>不读 owner_id</b>。
 * 需求文档 V1.2 已明确负责人字段保留但不再参与判权（术语表、事实 9）。
 *
 * <p>纪律 PMI-1：全部写接口默认拒绝，不允许在 Controller 上单独关闭拦截。
 */
@Component
public class PermissionInterceptor implements HandlerInterceptor {

    /**
     * 用户账号唯一允许的两个业务写接口（需求文档 6.2.5）。
     * <b>这个集合只有两条，新增任何一条都需要先改需求文档 6.2 的权限矩阵。</b>
     */
    private static final Set<String> USER_WRITABLE = Set.of(
            "POST /api/cases/{id}/likes",
            "POST /api/cases/{id}/comments"
    );

    /**
     * 认证入口。登录与登出不是业务写操作：请求到达时尚无账号类型可判，
     * 用户账号也必须能够登录。放行范围仅此两条。
     */
    private static final Set<String> AUTH_ENDPOINTS = Set.of(
            "POST /api/auth/login",
            "POST /api/auth/logout"
    );

    private final CurrentAccount currentAccount;

    public PermissionInterceptor(CurrentAccount currentAccount) {
        this.currentAccount = currentAccount;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (isReadOnlyMethod(request.getMethod())) {
            // 读接口无任何数据级过滤：一期读权限完全无差异（纪律 PMI-2）
            return true;
        }

        String route = routePattern(request);
        if (AUTH_ENDPOINTS.contains(route)) {
            return true;
        }

        Optional<AccountType> account = currentAccount.find();
        if (account.isEmpty()) {
            throw new ForbiddenException("请先登录后再执行该操作");
        }
        if (account.get().isOperator()) {
            return true;
        }
        if (USER_WRITABLE.contains(route)) {
            return true;
        }
        throw new ForbiddenException("用户账号为只读账号，仅可点赞与评论；该操作需要运营账号");
    }

    private boolean isReadOnlyMethod(String method) {
        return HttpMethod.GET.matches(method)
                || HttpMethod.HEAD.matches(method)
                || HttpMethod.OPTIONS.matches(method);
    }

    /**
     * 取 Spring MVC 匹配到的路径模板（如 {@code /api/cases/{id}/likes}）而不是实际 URI，
     * 否则白名单要为每个 id 写一条。
     */
    private String routePattern(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String path = pattern != null ? pattern.toString() : request.getRequestURI();
        return request.getMethod() + " " + path;
    }
}
