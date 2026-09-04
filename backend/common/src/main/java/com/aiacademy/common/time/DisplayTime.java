package com.aiacademy.common.time;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * 把时间拼进「直接给用户看的中文 message」时用这里，不要用 {@code String.valueOf(时间)}。
 *
 * <p>规则 7.2 要求 {@code message} 可直接展示给用户，设计规范 3.3 规定含时间的显示格式是
 * {@code YYYY-MM-DD HH:mm}、不显示秒。但 message 是字符串拼接出来的，
 * <b>绕过了 Jackson</b>——{@code spring.jackson.time-zone: Asia/Shanghai} 只管 JSON
 * 字段的序列化，管不到 {@code "%s".formatted(offsetDateTime)}。那条路径走的是
 * {@link OffsetDateTime#toString()}，输出的是 JDBC 驱动给出的偏移量，实测为
 * {@code 2026-09-04T11:33:48.166568Z}。
 *
 * <p>于是运营在 19:33 撞上乐观锁冲突，看到的是「最后修改：11:33」——差 8 小时，还带 6 位微秒。
 * 而这句提示存在的唯一目的，就是让运营相信「真有别人刚改过」而不是把冲突当成系统故障。
 * 一个 8 小时前的时间戳恰好证明了相反的事：那个点根本没人上班。
 */
public final class DisplayTime {

    /**
     * 与 {@code application.yml} 的 {@code spring.jackson.time-zone} 保持一致。
     * 两处都写死同一个值，是因为业务模块不该为了取一个时区去依赖 Web 层配置；
     * 改时区时这两处要一起改。
     */
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private DisplayTime() {
    }

    /**
     * @return 形如 {@code 2026-09-04 19:33}；入参为 null 时返回「未知时间」，
     *         这样调用方不必各自处理空值（原先 6 处调用点各写了一遍三元表达式）
     */
    public static String human(OffsetDateTime time) {
        return time == null ? "未知时间" : FORMATTER.format(time.atZoneSameInstant(ZONE));
    }
}
