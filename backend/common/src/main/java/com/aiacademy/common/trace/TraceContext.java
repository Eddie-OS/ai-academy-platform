package com.aiacademy.common.trace;

import org.slf4j.MDC;

import java.util.UUID;

/**
 * traceId 上下文。《开发实施文档》7.2：traceId 全链路透传并写入日志，是生产问题排查的唯一线索。
 *
 * <p>单机部署、无 APM 组件（一期不做项第 16、18 条），因此 traceId 由本类生成而非从上游注入；
 * 但仍接受请求头传入，便于 Nginx 或压测工具串联。
 */
public final class TraceContext {

    public static final String MDC_KEY = "traceId";
    public static final String HEADER = "X-Trace-Id";

    private TraceContext() {
    }

    public static String start(String inbound) {
        String traceId = (inbound == null || inbound.isBlank()) ? generate() : inbound.trim();
        MDC.put(MDC_KEY, traceId);
        return traceId;
    }

    public static void clear() {
        MDC.remove(MDC_KEY);
    }

    /**
     * 当前 traceId。在无请求上下文处（定时任务、启动期）返回 null，
     * 此时响应里的 traceId 为 null 而不是伪造一个。
     */
    public static String currentTraceId() {
        return MDC.get(MDC_KEY);
    }

    private static String generate() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
}
