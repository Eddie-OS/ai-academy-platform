-- 课程详情「材料与版本」页：版本台账。
-- 不改 version_no 自动编号，不删版本，不写五个状态列。

ALTER TABLE dtl_course_material_version
    ADD COLUMN IF NOT EXISTS version_label VARCHAR(64),
    ADD COLUMN IF NOT EXISTS version_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS owner_no VARCHAR(32),
    ADD COLUMN IF NOT EXISTS updated_date DATE,
    ADD COLUMN IF NOT EXISTS courseware_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS recording_url VARCHAR(500);

ALTER TABLE dtl_course_material_version
    DROP CONSTRAINT IF EXISTS ck_course_version_status;
ALTER TABLE dtl_course_material_version
    ADD CONSTRAINT ck_course_version_status CHECK (
        version_status IS NULL OR version_status IN ('生效版本', '历史归档', '废弃版本'));

COMMENT ON COLUMN dtl_course_material_version.version_label IS '课程版本号台账别名，如 V1.0 初稿。官方 version_no 仍按 V1／V2 自动递增';
COMMENT ON COLUMN dtl_course_material_version.version_status IS '版本状态台账：生效版本／历史归档／废弃版本。不是状态机，不写流转日志';
COMMENT ON COLUMN dtl_course_material_version.owner_no IS '版本更新负责人工号';
COMMENT ON COLUMN dtl_course_material_version.updated_date IS '版本更新时间，纯日期';
COMMENT ON COLUMN dtl_course_material_version.courseware_url IS '课件 PPT 外链。附件仍走官方「课件」材料';
COMMENT ON COLUMN dtl_course_material_version.recording_url IS '试讲／授课录屏外链。平台不上传视频文件（N22／D10）';
