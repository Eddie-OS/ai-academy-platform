package com.aiacademy.common.exception;

import com.aiacademy.common.api.ErrorCode;

/**
 * 无写权限。唯一的抛出位置是权限拦截器（规则 AR-7、PMI-4）。
 */
public class ForbiddenException extends BizException {

    public ForbiddenException(String message) {
        super(ErrorCode.FORBIDDEN, message);
    }
}
