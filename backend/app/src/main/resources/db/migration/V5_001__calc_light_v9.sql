-- =============================================================================
-- V5_001__calc_light_v9.sql　三色灯判定改走 V-9 现行口径（阶段 5 收口）
--
-- 业务裁决（文档待修清单 V-9）：
--   蓝 = 正常运行（距预计完成尚有余量，剩余 > blue_threshold）
--   黄 = 需要关注（临近预计完成，剩余 0～blue_threshold）
--   红 = 已逾期 或 状态停滞（逾期优先于黄；停滞仍最先判）
--   无 = 算不出灯（无预计完成且未停滞；或已退出预警）
--
-- 勿改 V3_001：已合并脚本禁止修改（DB-3）；用 REPLACE 覆盖函数体。
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
DECLARE
    remain INT;
BEGIN
    IF is_terminal THEN
        RETURN 'NONE';
    END IF;

    -- 停滞 → 红（与预计完成无关；优先于逾期）
    IF last_state_changed_at IS NOT NULL
       AND (CURRENT_DATE - last_state_changed_at::DATE) > red_threshold THEN
        RETURN 'RED';
    END IF;

    IF expect_finish_date IS NULL THEN
        RETURN 'NONE';
    END IF;

    -- 已逾期 → 红（V-9：原黄灯语义并入红）
    IF CURRENT_DATE > expect_finish_date THEN
        RETURN 'RED';
    END IF;

    remain := expect_finish_date - CURRENT_DATE;

    -- 临近（含今天到期＝剩余 0）→ 黄
    IF remain >= 0 AND remain <= blue_threshold THEN
        RETURN 'YELLOW';
    END IF;

    -- 尚有余量 → 蓝（健康态）
    IF remain > blue_threshold THEN
        RETURN 'BLUE';
    END IF;

    RETURN 'NONE';
END;
$$;

COMMENT ON FUNCTION calc_light(DATE, TIMESTAMPTZ, INT, INT, BOOLEAN) IS
    '三色灯实时计算（V-9）。BLUE=正常运行／YELLOW=需要关注／RED=逾期或停滞／NONE=无预警';
