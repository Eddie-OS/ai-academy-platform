package com.aiacademy.app.web.controller;

import com.aiacademy.aggregate.metrics.domain.CockpitQuantityVO;
import com.aiacademy.aggregate.metrics.service.QuantityMetricsService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.R;
import com.aiacademy.common.exception.BizException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 数量类指标驾驶舱汇总（阶段 3B／3C／需求 15.1／15.3／15.5）。
 *
 * <p>按驾驶舱 scope 返回已接入卡的整数值。效率周期卡见 {@code /api/metrics/efficiency/summary}。
 */
@RestController
@RequestMapping("/api/metrics/quantity")
public class MetricsController {

    private final QuantityMetricsService quantity;

    public MetricsController(QuantityMetricsService quantity) {
        this.quantity = quantity;
    }

    @GetMapping("/{scope}")
    public R<Map<String, Long>> quantity(@PathVariable String scope) {
        CockpitQuantityVO vo = switch (scope) {
            case "demands" -> quantity.forDemands();
            case "courses" -> quantity.forCourses();
            case "lecturers" -> quantity.forLecturers();
            case "trainings" -> quantity.forTrainings();
            case "cases" -> quantity.forCases();
            default -> throw new BizException(ErrorCode.PARAM_INVALID, "未知的指标范围：" + scope);
        };
        return R.ok(vo.values());
    }
}
