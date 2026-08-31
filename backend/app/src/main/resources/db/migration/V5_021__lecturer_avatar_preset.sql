-- =============================================================================
-- V5_021__lecturer_avatar_preset.sql
--
-- 讲师头像：上传走附件；也可选平台现成的 60 张（male_01～30 / female_01～30）。
-- 两路互斥，选预设时 avatar_attachment_id 为空。
-- =============================================================================

ALTER TABLE biz_lecturer
    ADD COLUMN avatar_preset VARCHAR(16);

ALTER TABLE biz_lecturer
    ADD CONSTRAINT ck_lecturer_avatar_preset
        CHECK (avatar_preset IS NULL
            OR avatar_preset ~ '^(male|female)_(0[1-9]|[12][0-9]|30)$');

COMMENT ON COLUMN biz_lecturer.avatar_preset IS '平台现成头像文件名（不含路径与扩展名），与 avatar_attachment_id 互斥';
