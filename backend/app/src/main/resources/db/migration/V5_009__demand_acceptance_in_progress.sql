-- 分流与处理表单增加「验收中」。存储仍保留「验收通过／验收不通过」，归档前置不变。
ALTER TABLE biz_demand DROP CONSTRAINT ck_demand_acceptance_state;
ALTER TABLE biz_demand ADD CONSTRAINT ck_demand_acceptance_state CHECK (
    acceptance_state IS NULL OR acceptance_state IN ('待验收', '验收中', '验收通过', '验收不通过')
);
