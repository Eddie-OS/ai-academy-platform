-- =============================================================================
-- V2_004__case_interaction_and_report_fields.sql
--
-- 阶段 2 D-3：案例落地时把三张互动表与总结报告表对齐需求 12.4、12.6。
--
-- 按 DB-3「已合并的脚本禁止修改」，用新脚本改而不是回头改 V1_007。
--
-- 三处改动，理由各不相同：
--
-- 一、互动表的「浏览人工号／点赞人工号／评论人工号」换成「账号类型 + 来源IP」。
--     V1_007 建表时按常规做法留了工号列，但需求 12.4 在 V1.2 已按共享账号模型整体重写：
--     三类互动记录的字段是「案例ID、账号类型、时间、来源IP」，没有工号——共享账号下系统
--     不知道是谁。留着一个永远为 NULL 的工号列，下一个人会以为「这里本该记工号只是还没做」，
--     进而写出依赖它的去重逻辑，而 12.4 三次强调不去重。
--
--     来源IP 不是可有可无的补充：它是点赞防刷（同一 IP 对同一案例每分钟 5 次）唯一可用的
--     判据。没有这一列，那条规则就只能不做。
--
-- 二、评论表补「署名」。需求 12.4 的评论字段里有「署名（选填文本，≤20 字），留空显示匿名」，
--     这是共享账号下让评论有归属感的唯一办法。它与工号是两回事：署名是使用者自己敲的，
--     不校验、不关联人员台账。
--
-- 三、dtl_case_report 按需求 12.6 的字段表重建。建表时 12.6 只有页面描述没有字段清单，
--     字段是推导的（待修清单 S-6）；需求 V1.3 的 12.6 给出了完整字段表，推导的
--     report_period／remark 两列作废，换成统计区间的起止日与生成方式。处置方式与
--     V2_003 对 dtl_training_archive 的处理一致：这张表建起至今没有任何写入路径，删列不涉及数据。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 一、dtl_case_view　浏览记录（需求 12.4 第 1 行）
-- -----------------------------------------------------------------------------
ALTER TABLE dtl_case_view
    DROP COLUMN viewer_no;

ALTER TABLE dtl_case_view
    ADD COLUMN account_type VARCHAR(16) NOT NULL DEFAULT 'OPS',
    ADD COLUMN source_ip    VARCHAR(64);

ALTER TABLE dtl_case_view
    ALTER COLUMN account_type DROP DEFAULT;

ALTER TABLE dtl_case_view
    ADD CONSTRAINT ck_case_view_account_type CHECK (account_type IN ('OPS', 'USER', 'SYSTEM'));

COMMENT ON COLUMN dtl_case_view.account_type IS '账号类型（需求 12.4）。取值与两张审计日志同一套：OPS / USER / SYSTEM';
COMMENT ON COLUMN dtl_case_view.source_ip IS '来源IP（需求 12.4）。共享账号下唯一能区分「从哪台机器打开」的线索';


-- -----------------------------------------------------------------------------
-- 二、dtl_case_like　点赞（需求 12.4 第 2 行）
-- -----------------------------------------------------------------------------
ALTER TABLE dtl_case_like
    DROP COLUMN liker_no;

ALTER TABLE dtl_case_like
    ADD COLUMN account_type VARCHAR(16) NOT NULL DEFAULT 'OPS',
    ADD COLUMN source_ip    VARCHAR(64);

ALTER TABLE dtl_case_like
    ALTER COLUMN account_type DROP DEFAULT;

ALTER TABLE dtl_case_like
    ADD CONSTRAINT ck_case_like_account_type CHECK (account_type IN ('OPS', 'USER', 'SYSTEM'));

COMMENT ON COLUMN dtl_case_like.account_type IS '账号类型（需求 12.4）';
COMMENT ON COLUMN dtl_case_like.source_ip IS '来源IP。点赞防刷「同一 IP 对同一案例每分钟最多 5 次」的判据（需求 12.4）';

-- 防刷判定是「数一数这个 IP 一分钟内对这个案例点了几次」，每次点赞都要跑一遍。
-- 已有的 (case_id, liked_at) 索引扫不掉其他 IP 的记录，热门案例上这一扫会越来越慢
CREATE INDEX idx_case_like_throttle ON dtl_case_like (case_id, source_ip, liked_at);


-- -----------------------------------------------------------------------------
-- 三、dtl_case_comment　评论（需求 12.4 第 3 行）
-- -----------------------------------------------------------------------------
ALTER TABLE dtl_case_comment
    DROP COLUMN commenter_no;

ALTER TABLE dtl_case_comment
    ADD COLUMN account_type VARCHAR(16) NOT NULL DEFAULT 'OPS',
    ADD COLUMN signature    VARCHAR(20);

ALTER TABLE dtl_case_comment
    ALTER COLUMN account_type DROP DEFAULT;

ALTER TABLE dtl_case_comment
    ADD CONSTRAINT ck_case_comment_account_type CHECK (account_type IN ('OPS', 'USER', 'SYSTEM'));

COMMENT ON COLUMN dtl_case_comment.account_type IS '账号类型（需求 12.4）。用户账号可评论，故会出现 USER';
COMMENT ON COLUMN dtl_case_comment.signature IS '署名（需求 12.4，≤20 字，选填）。留空由前端显示「匿名」——不落库写「匿名」，那样就分不清是没填还是真叫这个名字';


-- -----------------------------------------------------------------------------
-- 四、dtl_case_report　总结报告，按需求 12.6 的字段表重建（待修清单 S-6 消解）
--
-- 统计区间存起止两个 DATE 而不是原来的 report_period VARCHAR(32)：报告内容要按区间去
-- 各业务表取数（12.6「自动生成的报告内容」四个段落），一个「2026-H1」的字符串没法进 SQL 的
-- WHERE。纯日期语义用 DATE 而不是 TIMESTAMPTZ，见 CLAUDE.md 第三节。
-- -----------------------------------------------------------------------------
ALTER TABLE dtl_case_report
    DROP COLUMN report_period,
    DROP COLUMN remark;

DROP INDEX IF EXISTS idx_case_report_period;

ALTER TABLE dtl_case_report
    ADD COLUMN period_start  DATE        NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN period_end    DATE        NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN generate_mode VARCHAR(16) NOT NULL DEFAULT '系统自动生成';

ALTER TABLE dtl_case_report
    ALTER COLUMN period_start DROP DEFAULT,
    ALTER COLUMN period_end DROP DEFAULT,
    ALTER COLUMN generate_mode DROP DEFAULT;

ALTER TABLE dtl_case_report
    ADD CONSTRAINT ck_case_report_generate_mode CHECK (generate_mode IN ('系统自动生成', '手动编辑')),
    ADD CONSTRAINT ck_case_report_period CHECK (period_end >= period_start);

COMMENT ON COLUMN dtl_case_report.period_start IS '统计区间起（需求 12.6）。自动生成的四个段落按它取数';
COMMENT ON COLUMN dtl_case_report.period_end IS '统计区间止（含当日）';
COMMENT ON COLUMN dtl_case_report.generate_mode IS '生成方式（需求 12.6）。系统自动生成后一经编辑即转为「手动编辑」，让人知道眼前的内容还是不是原始口径';

CREATE INDEX idx_case_report_period ON dtl_case_report (period_start, period_end) WHERE deleted = FALSE;
