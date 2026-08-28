-- =============================================================================
-- V5_004__demand_register_form.sql　登记表单现场口径（D-21）
--
-- 1）优先级由 高／中／低 迁到 P0／P1／P2，列加宽
-- 2）补业务背景、ROI 分析、备注、多负责人姓名
-- =============================================================================

ALTER TABLE biz_demand ALTER COLUMN priority TYPE VARCHAR(32);

-- 必须先摘掉旧 CHECK（高／中／低），再写入 P 级，否则 UPDATE 会被原约束拦住。
ALTER TABLE biz_demand DROP CONSTRAINT ck_demand_priority;
UPDATE biz_demand SET priority = 'P0（紧急重要）' WHERE priority = '高';
UPDATE biz_demand SET priority = 'P1（重要）' WHERE priority = '中';
UPDATE biz_demand SET priority = 'P2（一般）' WHERE priority = '低';
ALTER TABLE biz_demand ADD CONSTRAINT ck_demand_priority CHECK (
    priority IS NULL OR priority IN ('P0（紧急重要）', 'P1（重要）', 'P2（一般）')
);

ALTER TABLE biz_demand ADD COLUMN owner_names VARCHAR(500);
ALTER TABLE biz_demand ADD COLUMN business_background VARCHAR(2000);
ALTER TABLE biz_demand ADD COLUMN roi_analysis VARCHAR(2000);
ALTER TABLE biz_demand ADD COLUMN remark VARCHAR(2000);

UPDATE biz_demand SET owner_names = owner_no WHERE owner_names IS NULL AND owner_no IS NOT NULL;

COMMENT ON COLUMN biz_demand.owner_names IS '需求负责人姓名，多人用顿号分隔；owner_no 仍存第一人（工号或手填姓名）';
COMMENT ON COLUMN biz_demand.business_background IS '业务背景：痛点、用户场景或业务机会';
COMMENT ON COLUMN biz_demand.roi_analysis IS 'ROI 分析：量化或定性描述（现场口径；与 N14 冲突见 D-21）';
COMMENT ON COLUMN biz_demand.remark IS '备注：非结构化补充说明';
