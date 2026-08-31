-- =============================================================================
-- V5_022__lecturer_form_enum_adjust.sql
--
-- 新建表单口径再收口：等级到 L3 为止，上岗状态「下线」改称「已下线」。
-- 已合并脚本不改（DB-3），用新脚本换 CHECK 并改历史值。
-- =============================================================================

UPDATE biz_lecturer
   SET lecturer_level = 'L3'
 WHERE lecturer_level = 'L4'
   AND deleted = FALSE;

UPDATE biz_lecturer
   SET duty_state = '已下线'
 WHERE duty_state = '下线'
   AND deleted = FALSE;

ALTER TABLE biz_lecturer DROP CONSTRAINT ck_lecturer_level;
ALTER TABLE biz_lecturer DROP CONSTRAINT ck_lecturer_duty_state;

ALTER TABLE biz_lecturer
    ADD CONSTRAINT ck_lecturer_level CHECK (lecturer_level IN ('L0', 'L1', 'L2', 'L3')),
    ADD CONSTRAINT ck_lecturer_duty_state CHECK (duty_state IN ('可上岗', '暂停授课', '已下线'));

COMMENT ON COLUMN biz_lecturer.lecturer_level IS '讲师等级 L0–L3（业务确认的建档口径）';
COMMENT ON COLUMN biz_lecturer.duty_state IS '上岗状态：可上岗／暂停授课／已下线。排课仍看培养状态=可上岗，保存时两列同步';
