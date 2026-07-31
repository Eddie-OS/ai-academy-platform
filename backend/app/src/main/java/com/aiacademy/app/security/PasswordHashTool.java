package com.aiacademy.app.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * 生成共享账号口令的 BCrypt 哈希（规则 SEC5：加盐哈希存储，不得明文）。
 *
 * <p>部署时在服务器上运行，输出整串填进 {@code .env} 的
 * {@code OPERATOR_PASSWORD_HASH} / {@code VIEWER_PASSWORD_HASH}：
 *
 * <pre>
 * # 开发机
 * cd backend &amp;&amp; ./gradlew :app:printPasswordHash -Ppassword='你的口令'
 * # 生产机（镜像内已含本类）
 * docker compose exec app java -cp /app/app.jar -Dloader.main=... 或直接用上面的 gradle 任务
 * </pre>
 *
 * <p>口令本身不会被打印，也不写入任何日志（规则 SEC4）。
 */
public final class PasswordHashTool {

    private PasswordHashTool() {
    }

    public static void main(String[] args) {
        if (args.length != 1 || args[0].isBlank()) {
            System.err.println("用法：printPasswordHash -Ppassword='你的口令'");
            System.exit(2);
            return;
        }
        String hash = "{bcrypt}" + new BCryptPasswordEncoder().encode(args[0]);

        // 必须同时给出两种写法。BCrypt 哈希里含 $，而 Docker Compose 会把 .env 值里的
        // $xxx 当变量插值成空串，得到一个「前缀仍是 {bcrypt}$2、但中间少了一段」的残缺哈希。
        // 这种残缺哈希不会让应用启动失败，只会让登录永远失败，且没有任何日志指向 .env。
        System.out.println("原始哈希（写入 application-*.yml 或直接设环境变量时用这个）：");
        System.out.println(hash);
        System.out.println();
        System.out.println(".env 专用（$ 已转义为 $$，Docker Compose 读取后还原为原始哈希）：");
        System.out.println(hash.replace("$", "$$"));
    }
}
