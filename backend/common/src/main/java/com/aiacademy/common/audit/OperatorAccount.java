package com.aiacademy.common.audit;

/**
 * 双日志里的「操作账号」列（需求 5.11、5.12）。
 *
 * <p><b>这不是 {@link com.aiacademy.common.security.AccountType} 的复制品，两者的用途不同</b>，
 * 因此刻意分成两个枚举：
 *
 * <ul>
 *   <li>{@code AccountType} 是判权用的，只有运营与用户两值，且按 AR-7 只允许在 {@code app.security}
 *       与 {@code common.security} 两个包内被引用；</li>
 *   <li>本枚举是<b>留痕</b>用的，多一个 {@link #SYSTEM}——随主状态自动置子状态、定时任务自动关闭
 *       这类流转没有人在操作，需求 5.11 明确要求记为系统自动流转。</li>
 * </ul>
 *
 * <p>如果复用 {@code AccountType}，写日志的平台模块就要引用一个判权枚举，AR-7 的断言会红；
 * 更糟的是 SYSTEM 无处安放，只能伪造成「运营操作」，那样责任追溯就失真了。
 */
public enum OperatorAccount {

    /** 运营账号。一期全部写操作都由它发起。 */
    OPS("运营"),

    /**
     * 用户账号。只出现在操作审计日志里——用户账号只有点赞与评论两个写接口（需求 6.2.5），
     * 且这两个动作都不改状态，所以状态流转日志的 CHECK 约束里没有 USER。
     */
    USER("用户"),

    /** 系统自动流转。无人操作，如随主状态自动置子状态、任务自动关闭。 */
    SYSTEM("系统");

    /** 无请求上下文（定时任务、启动期造数）时写入 {@code operator_ip} 的占位值。 */
    public static final String SYSTEM_IP = "SYSTEM";

    private final String label;

    OperatorAccount(String label) {
        this.label = label;
    }

    /** 展示名。落库的是枚举名本身，与两张日志表的 CHECK 约束一致。 */
    public String label() {
        return label;
    }
}
