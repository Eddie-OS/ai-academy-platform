package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.DashboardOverviewApplicationService;
import com.aiacademy.app.web.dto.DashboardOverviewVO;
import com.aiacademy.common.api.R;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 总看板（需求第 7 章）。单接口聚合，前端不发数十个并行请求（开发 5.5.3）。
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardOverviewApplicationService overview;

    public DashboardController(DashboardOverviewApplicationService overview) {
        this.overview = overview;
    }

    @GetMapping("/overview")
    public R<DashboardOverviewVO> overview() {
        return R.ok(overview.overview());
    }
}
