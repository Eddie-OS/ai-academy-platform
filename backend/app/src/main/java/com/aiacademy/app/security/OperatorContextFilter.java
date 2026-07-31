package com.aiacademy.app.security;

import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.security.AccountType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 把当前会话的账号类型与来源 IP 放进 {@link OperatorContext}，供双日志写「操作账号」「操作IP」两列。
 *
 * <p><b>账号类型的转译只发生在这一处。</b>{@link AccountType} 按 AR-7 只允许在 {@code app.security}
 * 与 {@code common.security} 内被引用，而写日志的代码在 {@code platform/audit}；本过滤器是两者之间
 * 唯一的桥。平台模块因此看不到判权用的枚举，只看到留痕用的 {@link OperatorAccount}。
 */
public class OperatorContextFilter extends OncePerRequestFilter {

    private final CurrentAccount currentAccount;

    public OperatorContextFilter(CurrentAccount currentAccount) {
        this.currentAccount = currentAccount;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        OperatorAccount account = currentAccount.find()
                .map(OperatorContextFilter::toOperatorAccount)
                .orElse(OperatorAccount.SYSTEM);
        OperatorContext.set(account, ClientIp.of(request));
        try {
            chain.doFilter(request, response);
        } finally {
            // Tomcat 线程会被复用，不清理会让下一个请求继承上一个请求的账号与 IP
            OperatorContext.clear();
        }
    }

    private static OperatorAccount toOperatorAccount(AccountType type) {
        return type.isOperator() ? OperatorAccount.OPS : OperatorAccount.USER;
    }
}
