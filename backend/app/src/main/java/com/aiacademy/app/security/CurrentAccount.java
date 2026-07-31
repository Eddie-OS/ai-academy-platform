package com.aiacademy.app.security;

import com.aiacademy.common.security.AccountType;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.api.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 从会话中解析当前账号类型。
 *
 * <p><b>本类只允许被 {@code com.aiacademy.app.security} 包内的代码使用</b>（规则 AR-7）。
 * 业务代码里出现「取当前账号做判断」即为违规，ArchUnit 会拦下。
 */
@Component
public class CurrentAccount {

    public Optional<AccountType> find() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return Optional.empty();
        }
        for (GrantedAuthority authority : auth.getAuthorities()) {
            for (AccountType type : AccountType.values()) {
                if (type.authority().equals(authority.getAuthority())) {
                    return Optional.of(type);
                }
            }
        }
        return Optional.empty();
    }

    public AccountType require() {
        return find().orElseThrow(() -> new BizException(
                ErrorCode.UNAUTHENTICATED, ErrorCode.UNAUTHENTICATED.defaultMessage()));
    }
}
