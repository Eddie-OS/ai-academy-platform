package com.aiacademy.app.security;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.security.AccountType;
import com.aiacademy.platform.people.service.LoginLogRecorder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

/**
 * 共享账号登录。会话存在 JVM 内存（{@code HttpSession}），不引 Redis 与 Spring Session（不做项第 18 条）。
 *
 * <p>会话策略（需求文档 6.1.6）：无操作 2 小时失效（由 {@code server.servlet.session.timeout} 保证）、
 * 会话有效期 8 小时（绝对上限，由 {@link #LOGIN_AT} 与 {@link SessionLifetimeFilter} 保证）。
 */
@Service
public class LoginService {

    private static final Logger log = LoggerFactory.getLogger(LoginService.class);

    /** 会话建立时刻，用于 8 小时绝对上限判断。 */
    static final String LOGIN_AT = "aiacademy.loginAt";

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final SharedAccountProperties accounts;
    private final CurrentAccount currentAccount;
    private final LoginLogRecorder loginLogRecorder;

    public LoginService(AuthenticationManager authenticationManager,
                        SecurityContextRepository securityContextRepository,
                        SharedAccountProperties accounts,
                        CurrentAccount currentAccount,
                        LoginLogRecorder loginLogRecorder) {
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.accounts = accounts;
        this.currentAccount = currentAccount;
        this.loginLogRecorder = loginLogRecorder;
    }

    public AccountInfo login(String username, String password,
                             HttpServletRequest request, HttpServletResponse response) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password));
        } catch (AuthenticationException e) {
            recordLoginAttempt(username, request, false, "账号或密码错误");
            // 不区分「账号不存在」与「口令错误」，避免账号枚举；也不记录口令（规则 SEC4）
            throw new BizException(ErrorCode.UNAUTHENTICATED, "账号或密码错误");
        }

        // 防会话固定：换掉登录前的 JSESSIONID。changeSessionId 要求会话已存在，
        // 首次登录时请求上还没有会话（登录接口在 CSRF 之外不触发建会话），因此先建后换。
        if (request.getSession(false) == null) {
            request.getSession(true);
        } else {
            request.changeSessionId();
        }

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        request.getSession().setAttribute(LOGIN_AT, Instant.now().toEpochMilli());

        recordLoginAttempt(username, request, true, null);

        return currentInfo().orElseThrow(
                () -> new BizException(ErrorCode.INTERNAL_ERROR, "登录成功但账号类型解析失败"));
    }

    /**
     * 写登录记录。<b>异常一律吞掉</b>：登录是唯一入口，为一张辅助日志表把人挡在门外不成比例
     * （与双日志相反的取舍，理由见 {@link LoginLogRecorder}）。
     */
    private void recordLoginAttempt(String username, HttpServletRequest request,
                                    boolean success, String failReason) {
        try {
            loginLogRecorder.record(accountTypeOf(username), ClientIp.of(request),
                    request.getHeader("User-Agent"), success, failReason);
        } catch (RuntimeException e) {
            log.warn("写登录记录失败，登录流程继续", e);
        }
    }

    /**
     * 用户名对应哪个共享账号。两个都不匹配时返回 null——这类失败记录恰恰最该留（有人在猜用户名），
     * 因此 {@code sys_login_log.account_type} 允许为空。
     */
    private String accountTypeOf(String username) {
        if (accounts.operator().username().equals(username)) {
            return OperatorAccount.OPS.name();
        }
        if (accounts.viewer().username().equals(username)) {
            return OperatorAccount.USER.name();
        }
        return null;
    }


    public void logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    /** 未登录时返回 empty，由前端跳登录页（错误码 UNAUTHENTICATED 的前端处理）。 */
    public Optional<AccountInfo> currentInfo() {
        return currentAccount.find().map(this::toInfo);
    }

    private AccountInfo toInfo(AccountType type) {
        SharedAccountProperties.Account account =
                type.isOperator() ? accounts.operator() : accounts.viewer();
        return new AccountInfo(
                account.username(),
                account.displayName(),
                type.name(),
                type.label(),
                type.isOperator());
    }
}
