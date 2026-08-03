-- =============================================================================
-- V3_001__calc_light_function.sql　三色灯实时计算函数（开发 5.4.1）
--
-- 返回 API 码：BLUE / YELLOW / RED / NONE（与前端 WarningLight、Meta 枚举对齐）。
-- 快照表 snapshot_warning_light 的 CHECK 仍是中文「蓝／黄／红／无」，读写边界做映射
-- （见 LightColor），不要改已合并的 V1 表定义。
--
-- 用 STABLE 而不是 IMMUTABLE：函数体读 CURRENT_DATE（开发 5.4.1 性能提醒）。
-- 列表页按灯色筛选不要对函数结果建表达式索引，应把条件展开成 WHERE（LightFilterSql）。
-- =============================================================================

CREATE OR REPLACE FUNCTION calc_light(
    expect_finish_date DATE,
    last_state_changed_at TIMESTAMPTZ,
    blue_threshold INT,
    red_threshold INT,
    is_terminal BOOLEAN
) RETURNS VARCHAR(8)
    LANGUAGE plpgsql
    STABLE
AS $$
BEGIN
    -- L4：终态对象退出预警范围
    IF is_terminal THEN
        RETURN 'NONE';
    END IF;

    -- L3：红 > 黄 > 蓝。红灯只看 last_state_changed_at（L1），必须在空预计完成时间检查之前
    IF last_state_changed_at IS NOT NULL
       AND (CURRENT_DATE - last_state_changed_at::DATE) > red_threshold THEN
        RETURN 'RED';
    END IF;

    -- 13.4.4：预计完成时间为空时不参与蓝黄，仍可红（上面已判）
    IF expect_finish_date IS NULL THEN
        RETURN 'NONE';
    END IF;

    IF CURRENT_DATE > expect_finish_date THEN
        RETURN 'YELLOW';
    END IF;

    -- 剩余 0 天（今天=预计完成日）既不蓝也不黄：BETWEEN 1 AND 排除了 0
    IF (expect_finish_date - CURRENT_DATE) BETWEEN 1 AND blue_threshold THEN
        RETURN 'BLUE';
    END IF;

    RETURN 'NONE';
END;
$$;

COMMENT ON FUNCTION calc_light(DATE, TIMESTAMPTZ, INT, INT, BOOLEAN) IS
    '三色灯实时计算（开发 5.4.1）。返回 BLUE/YELLOW/RED/NONE；展示与筛选走此函数或等价 WHERE 展开，快照表仅作变化检测';
