package com.aiacademy.app.web.controller;

import com.aiacademy.aggregate.metrics.domain.CourseMonthlyOverviewVO;
import com.aiacademy.aggregate.metrics.domain.EfficiencySummaryVO;
import com.aiacademy.aggregate.metrics.service.EfficiencyMetricsService;
import com.aiacademy.common.api.R;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 效率类指标驾驶舱摘要（阶段 3C／需求 15.2）。
 */
@RestController
@RequestMapping("/api/metrics/efficiency")
public class EfficiencyMetricsController {

    private final EfficiencyMetricsService efficiency;

    public EfficiencyMetricsController(EfficiencyMetricsService efficiency) {
        this.efficiency = efficiency;
    }

    @GetMapping("/summary")
    public R<EfficiencySummaryVO> summary() {
        return R.ok(efficiency.summary());
    }

    @GetMapping("/course-monthly-overview")
    public R<CourseMonthlyOverviewVO> courseMonthlyOverview() {
        return R.ok(efficiency.courseMonthlyOverview());
    }
}
