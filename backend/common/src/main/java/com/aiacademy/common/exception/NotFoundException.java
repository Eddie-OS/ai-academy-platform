package com.aiacademy.common.exception;

import com.aiacademy.common.api.ErrorCode;

/**
 * 对象不存在或已被逻辑删除（规则 SEC2：全系统逻辑删除，查询一律带 deleted = false）。
 */
public class NotFoundException extends BizException {

    public NotFoundException(String message) {
        super(ErrorCode.NOT_FOUND, message);
    }
}
