-- 详情「分流与处理」：开发名称、各段备注、实际完成日、方案链接。
-- 不改状态列；状态仍只由状态机写入。

ALTER TABLE biz_demand
    ADD COLUMN IF NOT EXISTS dev_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS solution_remark TEXT,
    ADD COLUMN IF NOT EXISTS dev_remark TEXT,
    ADD COLUMN IF NOT EXISTS acceptance_remark TEXT,
    ADD COLUMN IF NOT EXISTS delivery_remark TEXT,
    ADD COLUMN IF NOT EXISTS actual_finish_date DATE,
    ADD COLUMN IF NOT EXISTS solution_link VARCHAR(2000);

COMMENT ON COLUMN biz_demand.dev_name IS '需求开发名称（出口二）。与解决方案名称并列';
COMMENT ON COLUMN biz_demand.solution_remark IS '解决方案处理备注';
COMMENT ON COLUMN biz_demand.dev_remark IS '需求开发处理备注';
COMMENT ON COLUMN biz_demand.acceptance_remark IS '业务验收备注，与验收意见独立';
COMMENT ON COLUMN biz_demand.delivery_remark IS '交付使用备注';
COMMENT ON COLUMN biz_demand.actual_finish_date IS '实际完成日期。与交付时间、上线时间独立，由运营手填';
COMMENT ON COLUMN biz_demand.solution_link IS '关联解决方案外链（http/https），附件另走 sys_attachment_ref';
