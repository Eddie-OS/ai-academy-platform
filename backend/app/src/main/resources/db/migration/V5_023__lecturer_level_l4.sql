-- =============================================================================
-- V5_023__lecturer_level_l4.sql
--
-- 等级口径改回 L0–L4。V5_022 已把 CHECK 收到 L3 并回写历史 L4→L3，
-- 已合并脚本不改（DB-3），这里只放宽约束，不回写已被改成 L3 的历史行。
-- =============================================================================

ALTER TABLE biz_lecturer DROP CONSTRAINT ck_lecturer_level;

ALTER TABLE biz_lecturer
    ADD CONSTRAINT ck_lecturer_level CHECK (lecturer_level IN ('L0', 'L1', 'L2', 'L3', 'L4'));

COMMENT ON COLUMN biz_lecturer.lecturer_level IS '讲师等级 L0–L4（业务确认的建档口径）';
