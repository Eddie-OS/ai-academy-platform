-- =============================================================================
-- V2_003__training_archive_fields.sql
--
-- 阶段 2 C-3：培训归档落地时把 dtl_training_archive 对齐需求 11.6。
--
-- 阶段 1 建这张表时，需求文档第 11 章还没有归档的字段清单，字段按「归档材料 = 若干附件 +
-- 说明」推导，做成了一张**多行的材料条目表**（material_name + attachment_id + remark），
-- 当时就记入了待修文档清单。需求 V1.3 的 11.6 给出的是另一种结构：**每个场次一条归档记录**，
-- 含现场照片、课程PPT、直播链接、视频链接、培训纪要与归档完成标记。
--
-- 按 DB-3「已合并的脚本禁止修改」，用新脚本改而不是改 V1_006。
--
-- 三列直接删掉而不是留着不写：
--   * 这张表从建起到现在没有任何写入路径（阶段 1 的三个导入 Handler 都不碰它），删列不涉及数据；
--   * 留着一个 NOT NULL 的 material_name 会逼调用方填一个没有意义的值，而下一个人会以为
--     那是需求要求的字段。
--
-- 三类附件（现场照片、课程PPT、培训纪要附件）走通用附件引用 sys_attachment_ref，
-- ref_type = 'TRAINING_SESSION'，ref_field 分别是 archive_photos / archive_ppt /
-- archive_minutes——与需求侧的 review_minutes / solution_files 同一套机制，不再单开一张
-- 材料表。判断标准见 V1_003 的说明：同一条业务记录上有多组多附件时才用引用表，正是这里。
-- =============================================================================

ALTER TABLE dtl_training_archive
    DROP COLUMN material_name,
    DROP COLUMN attachment_id,
    DROP COLUMN remark;

ALTER TABLE dtl_training_archive
    ADD COLUMN live_link         VARCHAR(500),
    ADD COLUMN video_link        VARCHAR(500),
    ADD COLUMN minutes_text      VARCHAR(5000),
    ADD COLUMN archive_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN completed_at      TIMESTAMPTZ;

COMMENT ON TABLE dtl_training_archive IS '培训归档记录（需求 11.6）。每个场次一条，附件走 sys_attachment_ref';
COMMENT ON COLUMN dtl_training_archive.live_link IS '直播链接（需求 11.6）。一期只填外部链接，不上传视频文件（N22、D10）';
COMMENT ON COLUMN dtl_training_archive.video_link IS '视频链接（需求 11.6）。同上，URL 格式校验';
COMMENT ON COLUMN dtl_training_archive.minutes_text IS '培训纪要正文。纪要附件走 sys_attachment_ref 的 archive_minutes';
COMMENT ON COLUMN dtl_training_archive.archive_completed IS '归档完成标记（需求 11.6）。置「是」后场次可转「已归档」';
COMMENT ON COLUMN dtl_training_archive.completed_at IS '归档完成标记置为「是」的时刻。不是状态变更，不写状态流转日志';

-- 一个场次只能有一条归档记录。没有这个约束，两名运营同时打开归档页各存一次就会出现两条，
-- 而页面只会显示先查到的那一条——另一条填的内容就此消失，且没有任何报错
CREATE UNIQUE INDEX uk_training_archive_session
    ON dtl_training_archive (session_id) WHERE deleted = FALSE;
