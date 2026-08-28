package com.aiacademy.aggregate.warning.domain;

/**
 * 列表页灯色筛选的 WHERE 展开（开发 5.4.1；判定口径 V-9）。
 *
 * <p>{@code calc_light} 用了 {@code CURRENT_DATE}，是 STABLE 不是 IMMUTABLE，不能建表达式索引。
 * 筛选时把灯色条件展开成可走 {@code expect_*}／{@code last_state_changed_at} 普通索引的谓词；
 * 本类给出与函数等价的布尔表达式，供 Mapper XML 内联或测试对账。
 *
 * <p><b>不引入业务模块依赖</b>：调用方自行填入列名与阈值绑定参数。
 */
public final class LightFilterSql {

    private LightFilterSql() {
    }

    /**
     * @param expectCol      预计完成时间列，如 {@code d.expect_finish_date}
     * @param lastChangedCol 最后状态变更时间列，如 {@code d.last_state_changed_at}
     * @param outOfScopeExpr 退出预警范围的布尔表达式，如 {@code d.delivery_mark = '已归档'}
     * @param lightParam     MyBatis 灯色参数占位，如 {@code #{q.light}}
     * @param blueParam      蓝灯阈值参数，如 {@code #{blueDays}}（V-9：余量阈值）
     * @param redParam       红灯阈值参数，如 {@code #{redDays}}（停滞天数）
     */
    public static String matches(String expectCol, String lastChangedCol, String outOfScopeExpr,
                                 String lightParam, String blueParam, String redParam) {
        // 与 calc_light（V-9）同序：终态 → 红(停滞) →（空预计）→ 红(逾期) → 黄(临近) → 蓝(余量)
        String redDaysExpr = "(CURRENT_DATE - " + lastChangedCol + "::DATE)";
        String remainExpr = "(" + expectCol + " - CURRENT_DATE)";
        return """
                CASE
                  WHEN (%s) THEN 'NONE'
                  WHEN %s IS NOT NULL AND %s > %s THEN 'RED'
                  WHEN %s IS NULL THEN 'NONE'
                  WHEN CURRENT_DATE > %s THEN 'RED'
                  WHEN %s BETWEEN 0 AND %s THEN 'YELLOW'
                  WHEN %s > %s THEN 'BLUE'
                  ELSE 'NONE'
                END = %s
                """.formatted(
                outOfScopeExpr,
                lastChangedCol, redDaysExpr, redParam,
                expectCol,
                expectCol,
                remainExpr, blueParam,
                remainExpr, blueParam,
                lightParam).trim();
    }
}
