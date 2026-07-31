package com.aiacademy.common.exception;

import com.aiacademy.common.api.ErrorCode;

/**
 * 业务异常基类。全局异常处理器据此装配 {@link com.aiacademy.common.api.R}。
 *
 * <p><b>message 必须是可直接展示给用户的中文</b>（《开发实施文档》7.2）。
 * context 用于携带结构化上下文，例如状态机拒绝时的 currentState 与 action。
 */
public class BizException extends RuntimeException {

    private final ErrorCode errorCode;
    private final Object context;

    public BizException(ErrorCode errorCode, String message) {
        this(errorCode, message, null);
    }

    public BizException(ErrorCode errorCode, String message, Object context) {
        super(message);
        this.errorCode = errorCode;
        this.context = context;
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public Object context() {
        return context;
    }
}
