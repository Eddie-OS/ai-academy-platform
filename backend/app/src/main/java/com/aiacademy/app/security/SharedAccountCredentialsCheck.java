package com.aiacademy.app.security;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * 生产环境启动自检：两个共享账号的口令必须是 BCrypt 哈希。
 *
 * <p>共享账号模型下「口令一旦外泄即为全量写权限泄露」（需求文档 AC4），而系统内没有第二道防线（SEC6）。
 * 因此把「本地开发用的明文口令被带上生产」这一类错误改成<b>启动失败</b>，而不是留到上线后才发现。
 */
@Component
@Profile("prod")
public class SharedAccountCredentialsCheck implements InitializingBean {

    /**
     * 完整的 BCrypt 哈希结构：算法版本 + 代价因子 + 22 位盐 + 31 位摘要，共 53 个 base64 字符。
     *
     * <p>只校验 {@code {bcrypt}$2} 前缀是不够的。BCrypt 哈希里含 {@code $}，
     * 而 Docker Compose 会把 {@code .env} 里的 {@code $xxx} 当变量插值成空串，
     * 产出「前缀完好、中间少一段」的残缺哈希。它能通过前缀检查、能让应用正常启动，
     * 但登录永远失败，且日志里没有任何线索指向 {@code .env}——排查成本极高。
     * 这里按完整长度与字符集校验，把它变成启动失败。
     */
    private static final java.util.regex.Pattern BCRYPT =
            java.util.regex.Pattern.compile("^\\{bcrypt}\\$2[aby]?\\$\\d{2}\\$[./A-Za-z0-9]{53}$");

    private final SharedAccountProperties accounts;

    public SharedAccountCredentialsCheck(SharedAccountProperties accounts) {
        this.accounts = accounts;
    }

    @Override
    public void afterPropertiesSet() {
        verify("运营账号", accounts.operator());
        verify("用户账号", accounts.viewer());
    }

    private void verify(String label, SharedAccountProperties.Account account) {
        if (account == null || account.passwordHash() == null || account.passwordHash().isBlank()) {
            throw new IllegalStateException(label + "的口令未配置：请设置环境变量后重启（见 README 配置与敏感信息）");
        }
        if (!account.passwordHash().startsWith("{bcrypt}$2")) {
            throw new IllegalStateException(
                    label + "的口令不是 BCrypt 哈希（规则 SEC5）：生产环境禁止使用明文或 {noop} 口令");
        }
        if (!BCRYPT.matcher(account.passwordHash()).matches()) {
            throw new IllegalStateException(label + "的口令哈希结构不完整，长度 "
                    + account.passwordHash().length() + "，应为 68（{bcrypt} + $2a$10$ + 53 位）。"
                    + "最常见原因：.env 里的 $ 未转义，被 Docker Compose 当成变量插值掉了。"
                    + "用 gradlew :app:printPasswordHash 输出的「.env 专用」那一行重新填写");
        }
    }
}
