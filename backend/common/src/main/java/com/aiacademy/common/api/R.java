package com.aiacademy.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.aiacademy.common.trace.TraceContext;

/**
 * 统一响应包装，对应《开发实施文档》7.2。
 *
 * <pre>
 * { "code": "OK", "message": null, "data": {}, "traceId": "a1b2c3d4" }
 * </pre>
 *
 * @param code    错误码，取值见 {@link ErrorCode}
 * @param message 可直接展示给用户的中文；成功时为 null
 * @param data    业务数据；失败时可携带结构化上下文供前端做精细提示
 * @param traceId 全链路追踪号，生产问题排查的唯一线索
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record R<T>(String code, String message, T data, String traceId) {

    public static <T> R<T> ok(T data) {
        return new R<>(ErrorCode.OK.name(), null, data, TraceContext.currentTraceId());
    }

    public static R<Void> ok() {
        return ok(null);
    }

    public static <T> R<T> fail(ErrorCode code, String message, T data) {
        return new R<>(code.name(), message, data, TraceContext.currentTraceId());
    }

    public static R<Void> fail(ErrorCode code, String message) {
        return fail(code, message, null);
    }
}
