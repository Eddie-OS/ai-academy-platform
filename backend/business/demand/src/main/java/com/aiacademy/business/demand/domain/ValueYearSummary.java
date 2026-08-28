package com.aiacademy.business.demand.domain;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 需求 15.6：本年度业务价值汇总（按成本节约单位分组）。
 */
public record ValueYearSummary(
        int year,
        long efficiencyGainCount,
        long qualityGainCount,
        Map<String, BigDecimal> costSavingByUnit
) {
}
