-- =============================================================================
-- V5_020__lecturer_profile_archive.sql
--
-- 业务确认：讲师建档改走「基础档案」口径（截图表 14 项），不再只用需求 10.3 那套。
-- 培养状态三值仍保留（排课校验一、导入、指标 12a/12b 还在读），上岗状态是新建表单上的那一列。
-- 已记入 docs/文档待修清单.md（业务已裁决，覆盖 N6 对层级／标签／可授课时间的一期禁区）。
-- =============================================================================

ALTER TABLE biz_lecturer
    ADD COLUMN avatar_attachment_id BIGINT,
    ADD COLUMN lecturer_level VARCHAR(8) NOT NULL DEFAULT 'L0',
    ADD COLUMN capability_tags VARCHAR(500),
    ADD COLUMN available_time VARCHAR(200),
    ADD COLUMN duty_state VARCHAR(16) NOT NULL DEFAULT '暂停授课',
    ADD COLUMN schedule_limit VARCHAR(200),
    ADD COLUMN profile_maintainer VARCHAR(50),
    ADD COLUMN remark VARCHAR(500);

UPDATE biz_lecturer
   SET duty_state = CASE WHEN training_state = '可上岗' THEN '可上岗' ELSE '暂停授课' END,
       profile_maintainer = COALESCE(profile_maintainer, created_by);

ALTER TABLE biz_lecturer
    ADD CONSTRAINT ck_lecturer_level CHECK (lecturer_level IN ('L0', 'L1', 'L2', 'L3', 'L4')),
    ADD CONSTRAINT ck_lecturer_duty_state CHECK (duty_state IN ('可上岗', '暂停授课', '下线'));

CREATE INDEX idx_lecturer_duty_state ON biz_lecturer (duty_state) WHERE deleted = FALSE;

COMMENT ON COLUMN biz_lecturer.avatar_attachment_id IS '讲师头像，挂 sys_attachment';
COMMENT ON COLUMN biz_lecturer.lecturer_level IS '讲师等级 L0–L4（业务确认的建档口径）';
COMMENT ON COLUMN biz_lecturer.capability_tags IS '能力标签，自由文本，不是二期能力评估模型';
COMMENT ON COLUMN biz_lecturer.available_time IS '可授课时间，闲时描述，不是日历集成';
COMMENT ON COLUMN biz_lecturer.duty_state IS '上岗状态：可上岗／暂停授课／下线。排课仍看培养状态=可上岗，保存时两列同步';
COMMENT ON COLUMN biz_lecturer.schedule_limit IS '排课限制说明，如每月不超过 3 场';
COMMENT ON COLUMN biz_lecturer.profile_maintainer IS '档案维护人';
COMMENT ON COLUMN biz_lecturer.remark IS '备注信息';
