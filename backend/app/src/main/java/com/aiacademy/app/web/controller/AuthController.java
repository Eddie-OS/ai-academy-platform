package com.aiacademy.app.web.controller;

import com.aiacademy.app.security.AccountInfo;
import com.aiacademy.app.security.LoginService;
import com.aiacademy.common.api.R;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 登录、登出与当前登录态。
 *
 * <p>一期不做注册、找回密码、手机验证（需求文档 6.1.6 第 1 条）。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final LoginService loginService;

    public AuthController(LoginService loginService) {
        this.loginService = loginService;
    }

    public record LoginRequest(@NotBlank(message = "请输入账号") String username,
                               @NotBlank(message = "请输入密码") String password) {
    }

    @PostMapping("/login")
    public R<AccountInfo> login(@Validated @RequestBody LoginRequest body,
                                HttpServletRequest request,
                                HttpServletResponse response) {
        return R.ok(loginService.login(body.username(), body.password(), request, response));
    }

    @PostMapping("/logout")
    public R<Void> logout(HttpServletRequest request) {
        loginService.logout(request);
        return R.ok();
    }

    /**
     * 前端启动时调用。未登录返回 data = null，由前端跳登录页，
     * 不返回 401 以免在登录页上产生一次无意义的错误提示。
     */
    @GetMapping("/current")
    public R<AccountInfo> current() {
        return R.ok(loginService.currentInfo().orElse(null));
    }
}
