package com.aiacademy.common.api;

import org.springframework.http.HttpStatus;

/**
 * 一期错误码全集，对应《开发实施文档》7.3。
 *
 * <p>一期不搞几百个细分错误码，按处理方式分类，只有这 12 个。<b>新增错误码需要先改文档 7.3。</b>
 */
public enum ErrorCode {

    OK(HttpStatus.OK, "成功"),

    PARAM_INVALID(HttpStatus.BAD_REQUEST, "参数校验失败"),

    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "未登录或会话已过期"),

    FORBIDDEN(HttpStatus.FORBIDDEN, "无权限"),

    NOT_FOUND(HttpStatus.NOT_FOUND, "对象不存在或已删除"),

    /** 状态机非法转换，需求文档 5.1 规则 C3。 */
    ILLEGAL_TRANSITION(HttpStatus.CONFLICT, "当前状态不允许执行该动作"),

    /** 乐观锁冲突，需求文档 16.1.2 规则 K1。共享账号下这是常态而非偶发。 */
    CONCURRENT_MODIFIED(HttpStatus.CONFLICT, "该记录已被他人修改，请刷新后重试"),

    /** 幂等键命中，规则 K2/K3。前端应静默忽略并表现为「操作成功」。 */
    DUPLICATE_SUBMIT(HttpStatus.CONFLICT, "请求已处理"),

    /** 催办防重复窗口（48 小时，决策 D41）。 */
    URGE_TOO_FREQUENT(HttpStatus.CONFLICT, "距上次催办不足 48 小时"),

    IMPORT_VALIDATION_FAILED(HttpStatus.UNPROCESSABLE_ENTITY, "导入校验失败"),

    BIZ_RULE_VIOLATED(HttpStatus.UNPROCESSABLE_ENTITY, "业务规则不满足"),

    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "系统异常，请联系管理员");

    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(HttpStatus httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus httpStatus() {
        return httpStatus;
    }

    /**
     * 默认中文提示。业务抛异常时应给出更具体的文案；
     * 《开发实施文档》7.2 要求 message 是可直接展示给用户的中文，不是异常堆栈。
     */
    public String defaultMessage() {
        return defaultMessage;
    }
}
