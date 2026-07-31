package com.aiacademy.platform.people.service;

import com.aiacademy.platform.people.domain.LoginLog;
import com.aiacademy.platform.people.repository.LoginLogMapper;
import org.springframework.stereotype.Service;

/**
 * 记一条登录记录（开发 6.2.1）。
 *
 * <p><b>成功与失败都记。</b>失败记录是发现「有人在猜口令」的唯一线索，而共享账号的口令写在配置
 * 文件里、不会定期轮换，这个线索的价值比一人一账号的系统更高。
 *
 * <p>写日志失败<b>不能影响登录本身</b>——这是它与双日志相反的一点。双日志失败要回滚业务
 * （需求 16.1.3），但登录是用户唯一的入口，因为一张辅助日志表写不进去就把人挡在门外不成比例。
 * 因此调用方在独立事务里调用它，并容忍异常。
 */
@Service
public class LoginLogRecorder {

    private final LoginLogMapper mapper;

    public LoginLogRecorder(LoginLogMapper mapper) {
        this.mapper = mapper;
    }

    /**
     * @param accountType OPS / USER，用户名不匹配任一共享账号时传 null
     * @param failReason 失败原因。<b>不得包含口令内容</b>（规则 SEC4）
     */
    public void record(String accountType, String loginIp, String userAgent,
                       boolean success, String failReason) {
        LoginLog log = new LoginLog();
        log.setAccountType(accountType);
        log.setLoginIp(loginIp);
        log.setUserAgent(truncate(userAgent));
        log.setSuccess(success);
        log.setFailReason(failReason);
        // logged_at 用列默认值 NOW()
        mapper.insert(log);
    }

    /** user_agent 列限长 500，浏览器 UA 串正常在 200 以内，但插件会往里加东西。 */
    private String truncate(String userAgent) {
        if (userAgent == null) {
            return null;
        }
        return userAgent.length() <= 500 ? userAgent : userAgent.substring(0, 500);
    }
}
