package com.aiacademy.app.web;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.R;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.trace.TraceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 全局异常处理器：把异常翻译成《开发实施文档》7.2 的统一响应与 7.3 的 12 个错误码。
 *
 * <p><b>message 一律是可直接展示给用户的中文</b>，异常堆栈只进日志不进响应。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BizException.class)
    public ResponseEntity<R<Object>> handleBiz(BizException e) {
        ErrorCode code = e.errorCode();
        log.warn("业务异常 code={} message={}", code, e.getMessage());
        return ResponseEntity.status(code.httpStatus())
                .body(R.fail(code, e.getMessage(), e.context()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<R<Object>> handleValidation(MethodArgumentNotValidException e) {
        // 前端做字段级错误提示，因此把字段名与原因结构化返回
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : e.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        String first = fieldErrors.values().stream().findFirst()
                .orElse(ErrorCode.PARAM_INVALID.defaultMessage());
        return ResponseEntity.status(ErrorCode.PARAM_INVALID.httpStatus())
                .body(R.fail(ErrorCode.PARAM_INVALID, first, Map.of("fieldErrors", fieldErrors)));
    }

    /**
     * 找不到处理器与找不到静态资源，都是 404。
     *
     * <p>{@link NoResourceFoundException} 是 Spring 6.1 起静态资源未命中抛的异常，它<b>不是</b>
     * {@link NoHandlerFoundException} 的子类，因此原先会一路落到下面兜底的
     * {@code Exception} 分支：一个普通的地址拼错变成 {@code 500 INTERNAL_ERROR}，
     * 还带 traceId 和一整段堆栈写进 ERROR 日志。
     *
     * <p>两个后果都不轻：前端按 404 走空状态页的分支永远走不到（拿到的是 500 通用错误页）；
     * ERROR 日志被扫描器和拼错的收藏夹地址刷满，真实故障淹在里面。
     *
     * <p>单机模式下这条特别容易撞上——静态文件改由 Spring Boot 托管（见
     * {@code StandaloneWebConfig}），原先由 nginx 直接返回的 404 现在都进了 Spring MVC。
     */
    @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
    public ResponseEntity<R<Object>> handleNotFound(Exception e) {
        log.debug("未命中任何处理器或静态资源：{}", e.getMessage());
        return ResponseEntity.status(ErrorCode.NOT_FOUND.httpStatus())
                .body(R.fail(ErrorCode.NOT_FOUND, ErrorCode.NOT_FOUND.defaultMessage(), null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<R<Object>> handleUnexpected(Exception e) {
        // traceId 是排查生产问题的唯一线索，必须同时进日志与响应
        log.error("系统异常 traceId={}", TraceContext.currentTraceId(), e);
        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.httpStatus())
                .body(R.fail(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.defaultMessage(), null));
    }
}
