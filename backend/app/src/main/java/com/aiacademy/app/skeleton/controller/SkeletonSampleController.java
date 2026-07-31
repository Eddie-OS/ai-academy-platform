package com.aiacademy.app.skeleton.controller;

import com.aiacademy.app.skeleton.domain.SampleStateCount;
import com.aiacademy.app.skeleton.domain.SkeletonSample;
import com.aiacademy.app.skeleton.service.SkeletonSampleService;
import com.aiacademy.common.api.PageQuery;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * 阶段 0 的示例接口：登录后前端首页调用它，用来验证「前端 → Nginx → 后端 → 数据库」整条链路通。
 *
 * <p>接口命名遵循规则 API-1：{@code /api} 前缀、资源名复数英文小写连字符。
 * 阶段 1 开始后本 Controller 删除。
 */
@RestController
@RequestMapping("/api/skeleton-samples")
public class SkeletonSampleController {

    private final SkeletonSampleService service;

    public SkeletonSampleController(SkeletonSampleService service) {
        this.service = service;
    }

    @GetMapping
    public R<PageResult<SkeletonSample>> page(PageQuery query) {
        return R.ok(service.page(query));
    }

    @GetMapping("/state-counts")
    public R<List<SampleStateCount>> stateCounts() {
        return R.ok(service.countByState());
    }

    /**
     * 写接口范本，同时是 {@code PermissionInterceptor} 的验收对象：查看账号调用它必须拿到
     * 403 FORBIDDEN。Controller 里没有任何账号类型判断（规则 AR-7）。
     *
     * <p>用 {@link Principal} 而不是自取安全上下文，是为了不在业务代码里出现账号类型。
     */
    @PostMapping
    public R<SkeletonSample> create(@Validated @RequestBody CreateRequest body, Principal principal) {
        return R.ok(service.create(body.sampleName(), principal.getName()));
    }

    public record CreateRequest(@NotBlank(message = "请输入示例名称") String sampleName) {
    }
}
