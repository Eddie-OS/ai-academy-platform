package com.aiacademy.common.audit;

/**
 * 当前请求的操作者，供双日志写「操作账号」与「操作IP」两列。
 *
 * <p>写日志的代码在 {@code platform/audit}，而账号信息在 {@code app.security} 的会话里，
 * 平台模块不得依赖 app（AR-4）。因此按 {@link com.aiacademy.common.trace.TraceContext} 的同一
 * 套路，用 common 里的 ThreadLocal 做单向传递：<b>app.security 的过滤器写入，平台模块只读</b>。
 *
 * <p><b>缺省值是 {@link OperatorAccount#SYSTEM} 而不是抛异常</b>，因为定时任务与造数脚本本来
 * 就没有请求上下文，它们写的日志正该记成系统流转。若在此处强制要求已登录，第一个定时任务上线
 * 时就会在写日志这一步失败，而失败原因离真正的问题很远。
 */
public final class OperatorContext {

    private static final Operator SYSTEM =
            new Operator(OperatorAccount.SYSTEM, OperatorAccount.SYSTEM_IP);

    private static final ThreadLocal<Operator> CURRENT = new ThreadLocal<>();

    private OperatorContext() {
    }

    public static void set(OperatorAccount account, String ip) {
        CURRENT.set(new Operator(account, ip == null || ip.isBlank() ? "-" : ip));
    }

    public static void clear() {
        CURRENT.remove();
    }

    public static Operator current() {
        Operator operator = CURRENT.get();
        return operator == null ? SYSTEM : operator;
    }

    /**
     * @param account 操作账号
     * @param ip 操作IP。需求 5.12 要求必填：共享账号下这是唯一能区分「从哪台机器操作」的线索
     */
    public record Operator(OperatorAccount account, String ip) {
    }
}
