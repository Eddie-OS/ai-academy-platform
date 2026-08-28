-- =============================================================================
-- V5_003__demand_outlet_reject.sql　分流出口补第三条「需求驳回」（现场口径 D-20）
--
-- 需求 5.2.2 原文仅两值。现场要求录入评审结论时可选「需求驳回」，
-- 处理状态列固定展示「结束」，该条退出预警。不改解决方案／需求开发状态机。
-- 勿改 V1_003：已合并脚本禁止修改（DB-3）。
-- =============================================================================

ALTER TABLE biz_demand DROP CONSTRAINT ck_demand_outlet;
ALTER TABLE biz_demand ADD CONSTRAINT ck_demand_outlet CHECK (
    outlet IS NULL OR outlet IN (
        '用现有工具输出解决方案',
        '造工具需求开发',
        '需求驳回'
    )
);

COMMENT ON COLUMN biz_demand.outlet IS
    '分流出口。出口一激活解决方案状态，出口二激活需求开发状态，出口三需求驳回不激活状态组（处理状态展示为结束）';
