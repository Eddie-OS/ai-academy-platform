-- =============================================================================
-- V1_001__create_platform_tables.sql
--
-- 阶段 1B：平台模块 12 张表（开发实施文档 6.2.7）。
--
-- 本脚本先建平台表，因为双日志（audit_state_log、audit_op_log）是出口准则 E1-2／E1-3
-- 的验证对象，其余业务表都要往这两张表里写。
--
-- 公共字段模板见 V0_001 的注释与开发实施文档 6.1.2。两张日志表刻意不套用模板，理由见下。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- audit_state_log　状态流转日志（需求 5.11、开发 5.2.2）
--
-- 这是效率类 9 个指标与红灯停滞预警的唯一数据源，与 audit_op_log 严格分开，不得合并
-- （开发 5.2.1：合并后效率指标要在混杂大量字段编辑记录的表上做聚合，P2 会失守）。
--
-- 不套公共字段模板，两个原因：
--   1. 追加写、永不更新，updated_at / updated_by 恒等于创建值，是纯冗余；
--   2. 需求 5.11 要求「与业务对象同生命周期，永不删除」，给审计日志加 deleted 列等于
--      给「删审计记录」提供入口。日志的不可变性靠没有这一列来保证。
--
-- 操作人三列的取值遵循需求 5.11（不是开发 5.2.2 的 DDL，那份漏了 account_type 且把两个
-- 二期预留列写成了 NOT NULL）：
--   account_type   本期真正写入的操作者标识，OPS / SYSTEM
--   operator_no    二期一人一账号后写真实工号，本期为 NULL
--   operator_name  同上
-- 保留后两列是刻意的：二期开号时不需要改表结构、不需要迁移历史数据（开发 5.2.4）。
-- -----------------------------------------------------------------------------
CREATE TABLE audit_state_log
(
    id            BIGSERIAL PRIMARY KEY,
    object_type   VARCHAR(32) NOT NULL,
    object_id     BIGINT      NOT NULL,
    state_field   VARCHAR(64) NOT NULL,
    from_state    VARCHAR(64),
    to_state      VARCHAR(64) NOT NULL,
    action_code   VARCHAR(64) NOT NULL,
    account_type  VARCHAR(16) NOT NULL,
    operator_no   VARCHAR(50),
    operator_name VARCHAR(50),
    changed_at    TIMESTAMPTZ NOT NULL,
    remark        VARCHAR(500),

    CONSTRAINT ck_state_log_account_type CHECK (account_type IN ('OPS', 'SYSTEM'))
);

COMMENT ON TABLE audit_state_log IS '状态流转日志（需求 5.11）。效率指标与红灯判定的唯一数据源，永不删除';
COMMENT ON COLUMN audit_state_log.object_type IS '对象类型码，取状态机 objectType()：DEMAND / COURSE / COURSE_REVIEW / COURSE_TRIAL / TRAINING_PLAN / TRAINING_SESSION / CASE / TASK';
COMMENT ON COLUMN audit_state_log.state_field IS '状态字段中文名，与需求 5.11「状态字段名」及状态机 stateField() 一致，如「需求评审状态」';
COMMENT ON COLUMN audit_state_log.from_state IS '变更前状态。对象新建时为 NULL';
COMMENT ON COLUMN audit_state_log.action_code IS '触发本次转换的动作码，取自需求第 5 章转换表的「动作」列';
COMMENT ON COLUMN audit_state_log.account_type IS '操作账号（需求 5.11）。OPS = 运营，SYSTEM = 随主状态自动置位等系统流转。用户账号不能改状态，故无 USER';
COMMENT ON COLUMN audit_state_log.operator_no IS '二期一人一账号的预留列，本期恒为 NULL（开发 5.2.4）';
COMMENT ON COLUMN audit_state_log.operator_name IS '二期一人一账号的预留列，本期恒为 NULL（开发 5.2.4）';
COMMENT ON COLUMN audit_state_log.remark IS '变更说明。共享账号下运营可在此自报操作人姓名（需求 5.11、AC1）';

-- IX-4 第一个索引：效率指标查「某类对象首次到达某状态的时间」。
-- 列顺序按需求 15.2 的查询模式设计：先按对象类型 + 状态字段 + 目标状态过滤，
-- 再按对象分组取 MIN(changed_at)。改动列顺序会让 9 个效率指标全部退化为全表扫描。
CREATE INDEX idx_state_log_first_arrival
    ON audit_state_log (object_type, state_field, to_state, object_id, changed_at);

-- IX-4 第二个索引：状态时间线查「某对象的全部流转」
CREATE INDEX idx_state_log_object
    ON audit_state_log (object_type, object_id, changed_at);


-- -----------------------------------------------------------------------------
-- audit_op_log　操作审计日志（需求 5.12、开发 5.2.3）
--
-- 覆盖全部写操作，由 AOP 切面写入，做字段级 diff。不参与任何预警判定。
-- 与 audit_state_log 同样不套公共字段模板，理由同上。
--
-- old_value / new_value 限长 500：需求 5.12 要求记录变更前后值，但整体序列化 DTO 会把
-- 附件内容、长文本、以及 SEC4 禁止的凭据一起写进日志，因此切面只记录实际变化的字段并
-- 截断到 500 字符（开发 5.2.3 坑一）。
-- -----------------------------------------------------------------------------
CREATE TABLE audit_op_log
(
    id            BIGSERIAL PRIMARY KEY,
    object_type   VARCHAR(32) NOT NULL,
    object_id     BIGINT,
    op_type       VARCHAR(16) NOT NULL,
    field_name    VARCHAR(100),
    old_value     VARCHAR(500),
    new_value     VARCHAR(500),
    account_type  VARCHAR(16) NOT NULL,
    operator_no   VARCHAR(50),
    operator_name VARCHAR(50),
    operator_ip   VARCHAR(64) NOT NULL,
    operated_at   TIMESTAMPTZ NOT NULL,
    remark        VARCHAR(500),

    CONSTRAINT ck_op_log_op_type CHECK (op_type IN ('新增', '修改', '删除', '导入', '导出', '发送催办', '撤销导入')),
    CONSTRAINT ck_op_log_account_type CHECK (account_type IN ('OPS', 'USER', 'SYSTEM'))
);

COMMENT ON TABLE audit_op_log IS '操作审计日志（需求 5.12）。全部写操作的字段级留痕，不参与预警判定';
COMMENT ON COLUMN audit_op_log.object_id IS '对象ID。导入、导出这类不针对单个对象的操作为 NULL';
COMMENT ON COLUMN audit_op_log.op_type IS '操作类型（需求 5.12）。中文枚举，与 6.1.3 一致';
COMMENT ON COLUMN audit_op_log.field_name IS '被改字段名。修改类操作必填，其余操作为 NULL';
COMMENT ON COLUMN audit_op_log.old_value IS '变更前值，超长截断到 500 字符（开发 5.2.3）';
COMMENT ON COLUMN audit_op_log.new_value IS '变更后值，超长截断到 500 字符（开发 5.2.3）';
COMMENT ON COLUMN audit_op_log.account_type IS '操作账号（需求 5.12）。OPS / USER / SYSTEM。用户账号只有点赞与评论两个写接口，故会出现 USER';
COMMENT ON COLUMN audit_op_log.operator_ip IS '操作IP（需求 5.12，必填）。共享账号下这是唯一能区分「从哪台机器操作」的线索';
COMMENT ON COLUMN audit_op_log.remark IS '破坏性操作二次确认弹窗中选填的操作人（开发 5.2.4）';

CREATE INDEX idx_op_log_object
    ON audit_op_log (object_type, object_id, operated_at);

-- 审计追溯的第二种查法：按时间倒序翻页看「最近都改了什么」
CREATE INDEX idx_op_log_time
    ON audit_op_log (operated_at DESC);


-- -----------------------------------------------------------------------------
-- sys_task　任务（需求 13.1.1）
--
-- 「逾期标记」不建列：需求 13.1.1 第 9 项明确它是派生字段、实时计算、非状态
-- （阶段 3 提示词也重申「不建定时任务刷新、不存数据库列」）。
-- -----------------------------------------------------------------------------
CREATE TABLE sys_task
(
    id                    BIGSERIAL PRIMARY KEY,
    title                 VARCHAR(100) NOT NULL,
    task_type             VARCHAR(32)  NOT NULL,
    object_type           VARCHAR(32)  NOT NULL,
    object_id             BIGINT       NOT NULL,
    owner_no              VARCHAR(50),
    owner_name            VARCHAR(50),
    due_date              DATE         NOT NULL,
    task_state            VARCHAR(64)  NOT NULL,
    derive_type           VARCHAR(16)  NOT NULL,
    finished_at           TIMESTAMPTZ,
    remark                VARCHAR(1000),

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    last_state_changed_at TIMESTAMPTZ,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_task_state CHECK (task_state IN ('待处理', '处理中', '已完成', '已关闭')),
    CONSTRAINT ck_task_derive_type CHECK (derive_type IN ('系统派生', '人工创建'))
);

COMMENT ON TABLE sys_task IS '任务（需求 13.1.1）。10 类任务，系统派生或人工创建';
COMMENT ON COLUMN sys_task.task_type IS '任务类型，取值见需求 13.1.2 的 10 条派生规则';
COMMENT ON COLUMN sys_task.owner_no IS '责任人工号。系统派生时取对象负责人（需求 13.1.1 第 5 项）。V1.2 起为标注字段，不影响权限';
COMMENT ON COLUMN sys_task.owner_name IS '责任人姓名快照，不 JOIN 人员表取当前值';
COMMENT ON COLUMN sys_task.due_date IS '截止时间。DATE 而非 TIMESTAMPTZ——逾期按自然日判定（6.1.4）';
COMMENT ON COLUMN sys_task.last_state_changed_at IS '最后状态变更时间。任务状态机（需求 5.10）的转换要更新它，E1-2 要求「任意状态变更」';
COMMENT ON COLUMN sys_task.remark IS '备注。建议在此手写操作人姓名（需求 AC1）';

-- IX-2：列表页默认按状态筛选
CREATE INDEX idx_task_state ON sys_task (task_state) WHERE deleted = FALSE;
-- 任务中心「按负责人查看」下拉筛选（需求 13.1、AC3；IX-1 保留 owner_no 索引的新理由）
CREATE INDEX idx_task_owner ON sys_task (owner_no) WHERE deleted = FALSE;
-- 逾期实时计算 + 终态自动关闭都要按对象定位任务
CREATE INDEX idx_task_object ON sys_task (object_type, object_id) WHERE deleted = FALSE;
CREATE INDEX idx_task_due ON sys_task (due_date, task_state) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_escalation_record　催办台账（开发 5.8.3，需求 8.5、13.2）
--
-- 统一记录全部对象类型的线下催办，不按对象类型分表——催办台账要能跨对象类型统一查询
-- 与排序，分表后每次查询都要 UNION 六张表（开发 6.2.2）。
--
-- object_name 与 owner_name 冗余是有意的：台账是历史记录，一年后课程改了名、人离职了，
-- 台账里应该显示「当时催的是哪个课程、催的是谁」，不要 JOIN 取当前值（开发 5.8.3）。
--
-- 时间列用 TIMESTAMPTZ 而非开发 5.8.3 示例 DDL 里的 TIMESTAMP，遵循 6.1.4 的统一规定。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_escalation_record
(
    id            BIGSERIAL PRIMARY KEY,
    object_type   VARCHAR(32)  NOT NULL,
    object_id     BIGINT       NOT NULL,
    object_name   VARCHAR(200) NOT NULL,
    owner_no      VARCHAR(50),
    owner_name    VARCHAR(50),
    escalate_type VARCHAR(32)  NOT NULL,
    channel_note  VARCHAR(64),
    remark        VARCHAR(500),
    escalated_at  TIMESTAMPTZ  NOT NULL,

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(50)  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by    VARCHAR(50),
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_escalation_type CHECK (escalate_type IN ('逾期', '停滞', '即将到期', '其他'))
);

COMMENT ON TABLE dtl_escalation_record IS '催办台账（开发 5.8.3）。系统不发送任何消息，这里只记录线下已经发生的催办';
COMMENT ON COLUMN dtl_escalation_record.object_name IS '对象名称快照，不 JOIN 取当前值（开发 5.8.3）';
COMMENT ON COLUMN dtl_escalation_record.owner_no IS '被催办的负责人工号。对象无负责人时为 NULL';
COMMENT ON COLUMN dtl_escalation_record.owner_name IS '被催办人姓名快照，不 JOIN 取当前值（开发 5.8.3）';
COMMENT ON COLUMN dtl_escalation_record.channel_note IS '线下渠道备注：企业微信 / 电话 / 当面 / 其他。自由文本，不做枚举约束';
COMMENT ON COLUMN dtl_escalation_record.remark IS '运营自填。共享账号下用于自报姓名（开发 5.2.4）';
COMMENT ON COLUMN dtl_escalation_record.escalated_at IS '实际催办时间，允许回填过去时间。校验：不晚于当前时间、不早于对象创建时间（开发 5.8.3）';

-- 防重复规则 D1 查「同一对象 + 同一负责人最近一条」（开发 5.8.4）
CREATE INDEX idx_escalation_object ON dtl_escalation_record (object_type, object_id, escalated_at DESC);
CREATE INDEX idx_escalation_time ON dtl_escalation_record (escalated_at DESC);


-- -----------------------------------------------------------------------------
-- sys_attachment　附件元数据（开发 6.3.8，规则 F4、F5）
--
-- 只存文件本身的元数据，不知道自己被谁引用。引用关系由业务表持有 attachment_id——
-- 一个附件可能被多个业务位置引用（材料当前版本 + 多个历史版本快照），在附件表上放
-- course_id 会让 R7 的版本快照无法实现。
-- -----------------------------------------------------------------------------
CREATE TABLE sys_attachment
(
    id           BIGSERIAL PRIMARY KEY,
    file_name    VARCHAR(255) NOT NULL,
    file_size    BIGINT       NOT NULL,
    content_type VARCHAR(100),
    storage_path VARCHAR(500) NOT NULL,
    sha256       VARCHAR(64),

    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by   VARCHAR(50)  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by   VARCHAR(50),
    deleted      BOOLEAN      NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE sys_attachment IS '附件元数据（开发 6.3.8）。业务库只存元数据与存储路径，文件在本地磁盘（规则 F4）';
COMMENT ON COLUMN sys_attachment.storage_path IS '本地磁盘相对路径，如 course/202608/10231_xxx.pptx。不存绝对路径——否则挂载点一变全表都要 UPDATE（开发 6.3.8）';
COMMENT ON COLUMN sys_attachment.sha256 IS '文件摘要，用于秒传与去重';
COMMENT ON COLUMN sys_attachment.deleted IS '逻辑删除（规则 F5）。文件不做物理删除——历史版本快照可能仍引用它，物理删除会破坏 R7';

CREATE INDEX idx_attachment_sha256 ON sys_attachment (sha256) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- sys_attachment_ref　附件引用关系（本脚本新增，开发实施文档 6.2.7 的表清单未列出）
--
-- 为什么必须有这张表：
--   1. 需求里有大量「多附件」字段（评审会议纪要、解决方案附件、试讲附件、案例附件…），
--      开发 6.3.8 只说明了「引用关系由业务表持有 attachment_id」这一单附件情形，多附件
--      在业务表上放不下。
--   2. 决定性的理由是孤儿清理（TD-7.2、5.7.2）：每日任务要「删除超过 24 小时未被任何业务
--      对象引用的附件文件」，而它是**物理删除**。如果引用关系散落在各业务表的 JSONB 列里，
--      将来新增一个附件字段却漏改清理任务的查询，后果是被引用的文件被永久删除。有了这张
--      表，孤儿判定退化为一次 LEFT JOIN，新增附件字段不需要改清理任务。
--
-- 反过来说，业务价值填报的「关联需求 / 关联案例」用 JSONB 存 ID 数组即可，因为没有任何
-- 物理删除依赖它。两处取舍不同的判断标准是：有没有破坏性操作依赖这份引用关系的完整性。
-- -----------------------------------------------------------------------------
CREATE TABLE sys_attachment_ref
(
    id            BIGSERIAL PRIMARY KEY,
    attachment_id BIGINT      NOT NULL REFERENCES sys_attachment (id),
    ref_type      VARCHAR(32) NOT NULL,
    ref_id        BIGINT      NOT NULL,
    ref_field     VARCHAR(64) NOT NULL,
    seq_no        INT         NOT NULL DEFAULT 0,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(50) NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by    VARCHAR(50),
    deleted       BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_attachment_ref UNIQUE (ref_type, ref_id, ref_field, attachment_id)
);

COMMENT ON TABLE sys_attachment_ref IS '附件引用关系。一个附件可被多处引用（材料当前版本 + 多个历史版本快照），孤儿附件清理靠它判定';
COMMENT ON COLUMN sys_attachment_ref.ref_type IS '引用方对象类型，如 DEMAND / COURSE / COURSE_REVIEW / CASE';
COMMENT ON COLUMN sys_attachment_ref.ref_field IS '引用方的字段名，如 review_minutes / solution_files / cover_image。同一对象的多个附件字段靠它区分';
COMMENT ON COLUMN sys_attachment_ref.seq_no IS '同一字段下多个附件的展示顺序';

-- 孤儿判定：sys_attachment LEFT JOIN 本表，无未删除引用行且超过 24 小时的即孤儿
CREATE INDEX idx_attachment_ref_attachment ON sys_attachment_ref (attachment_id) WHERE deleted = FALSE;
-- 业务详情页取某对象某字段的附件列表
CREATE INDEX idx_attachment_ref_owner ON sys_attachment_ref (ref_type, ref_id, ref_field, seq_no) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- import_batch　导入批次（需求 13.8.4）
--
-- batch_no 唯一约束是幂等的落地点：批次号在上传解析阶段生成并返回前端，前端确认写入时
-- 带回；服务端靠唯一约束 + batch_state 状态机拒绝重复提交（开发 5.6.3 细节五）。
-- -----------------------------------------------------------------------------
CREATE TABLE import_batch
(
    id           BIGSERIAL PRIMARY KEY,
    batch_no     VARCHAR(64)  NOT NULL,
    import_type  VARCHAR(32)  NOT NULL,
    file_name    VARCHAR(255) NOT NULL,
    source_path  VARCHAR(500),
    total_rows   INT          NOT NULL DEFAULT 0,
    insert_rows  INT          NOT NULL DEFAULT 0,
    update_rows  INT          NOT NULL DEFAULT 0,
    batch_state  VARCHAR(32)  NOT NULL,
    import_result VARCHAR(16),
    error_report_path VARCHAR(500),
    imported_at  TIMESTAMPTZ,

    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by   VARCHAR(50)  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by   VARCHAR(50),
    deleted      BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_import_batch_no UNIQUE (batch_no),
    CONSTRAINT ck_import_type CHECK (import_type IN ('人员', '签到', '讲师', '参训名单', '学员反馈', '试讲反馈')),
    CONSTRAINT ck_import_batch_state CHECK (batch_state IN ('待确认', '已写入')),
    CONSTRAINT ck_import_result CHECK (import_result IS NULL OR import_result IN ('成功', '校验失败', '已撤销'))
);

COMMENT ON TABLE import_batch IS '导入批次（需求 13.8.4）。导入是一期唯一的批量数据入口';
COMMENT ON COLUMN import_batch.batch_no IS '批次号（规则 I5）：对象类型缩写 + 年月日时分秒。在上传解析阶段生成，不在提交时生成（开发 5.6.3 细节五）';
COMMENT ON COLUMN import_batch.import_type IS '6 类导入之一';
COMMENT ON COLUMN import_batch.source_path IS '上传原文件的存储路径，供「下载原文件」使用';
COMMENT ON COLUMN import_batch.total_rows IS '校验的数据行数，不含表头与示例行（需求 13.8.4）';
COMMENT ON COLUMN import_batch.update_rows IS '更新条数。两类反馈导入恒为 0，只追加不更新（需求 13.8.4）';
COMMENT ON COLUMN import_batch.batch_state IS '幂等状态机：待确认 → 已写入。重复提交时因已是「已写入」而拒绝（开发 5.6.3 细节五）';
COMMENT ON COLUMN import_batch.import_result IS '导入结果（需求 13.8.4）。校验阶段尚未产生结果时为 NULL';

CREATE INDEX idx_import_batch_type_time ON import_batch (import_type, imported_at DESC) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- import_row_snapshot　导入行级前值快照（开发 5.6.3 细节四）
--
-- 撤销（需求 13.8.5）依赖它：INSERT 的行执行逻辑删除，UPDATE 的行用 before_json 还原。
-- 用 JSONB 而非按表建快照表，是选 PostgreSQL 的直接收益之一。
-- 出口准则 E1-6「某批次导入撤销后数据完整还原」就是验证这张表。
-- -----------------------------------------------------------------------------
CREATE TABLE import_row_snapshot
(
    id           BIGSERIAL PRIMARY KEY,
    batch_no     VARCHAR(64) NOT NULL,
    row_no       INT         NOT NULL,
    target_table VARCHAR(64) NOT NULL,
    target_id    BIGINT,
    op           VARCHAR(8)  NOT NULL,
    before_json  JSONB,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   VARCHAR(50) NOT NULL,

    CONSTRAINT ck_import_snapshot_op CHECK (op IN ('INSERT', 'UPDATE'))
);

COMMENT ON TABLE import_row_snapshot IS '导入行级前值快照（开发 5.6.3 细节四）。批次撤销的还原依据';
COMMENT ON COLUMN import_row_snapshot.row_no IS 'Excel 行号，用于错误报告与撤销对账';
COMMENT ON COLUMN import_row_snapshot.target_id IS '被写入的业务行 ID。op = INSERT 时在写入后回填';
COMMENT ON COLUMN import_row_snapshot.before_json IS 'UPDATE 时的变更前完整行；INSERT 时为 NULL';

CREATE INDEX idx_import_snapshot_batch ON import_row_snapshot (batch_no);


-- -----------------------------------------------------------------------------
-- snapshot_warning_light　灯色快照（开发 5.4.2、5.8.5）
--
-- 只服务于「灯色是否发生变化」的检测（RM2、D2），一行一个对象、每日覆盖。展示与查询
-- 一律走实时计算，因此这张表不违反需求 13.4.4「灯色实时计算不落库」——13.4.4 禁止的是
-- 用存储的灯色对外展示（那会导致展示值过期）。这个区分要保留在注释里，否则容易被后来者
-- 误认为违规而删表。
--
-- 表名沿用开发 6.2.7 表清单的 snapshot_warning_light。开发 5.4.2 的示例 DDL 写作
-- warning_light_snapshot，两处不一致，已记入待修文档清单。
--
-- 不套公共字段模板：每个对象只有一行、每日整行覆盖，没有创建人与逻辑删除的语义。
-- -----------------------------------------------------------------------------
CREATE TABLE snapshot_warning_light
(
    object_type VARCHAR(32) NOT NULL,
    object_id   BIGINT      NOT NULL,
    light       VARCHAR(8)  NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (object_type, object_id),
    CONSTRAINT ck_warning_light CHECK (light IN ('无', '蓝', '黄', '红'))
);

COMMENT ON TABLE snapshot_warning_light IS '灯色快照（开发 5.4.2）。仅用于灯色变化检测，不用于任何展示与查询。消费方在阶段 3';
COMMENT ON COLUMN snapshot_warning_light.light IS '灯色。三色灯是三种警示态，「无」才是健康态（需求 13.4.1a、VC1～VC4）';


-- -----------------------------------------------------------------------------
-- dict_item　字典（需求 13.9.3）
--
-- 一期 3 类字典：作战单元、课程分类、自检 CheckList 清单项。
-- 「激励类型」已随激励整体推二期而删除（需求 13.9.3、N20）；开发 6.2.7 与 12.1 仍写
-- 「4 类字典（含激励类型、反馈类型）」，已记入待修文档清单——「反馈类型」在需求 13.9.3
-- 里根本不存在。
--
-- 作战单元字典不得硬编码为五个值（需求 13.9.3），初始值由 R__ 脚本装载（规则 DB-4）。
-- -----------------------------------------------------------------------------
CREATE TABLE dict_item
(
    id         BIGSERIAL PRIMARY KEY,
    dict_type  VARCHAR(32)  NOT NULL,
    item_code  VARCHAR(64)  NOT NULL,
    item_name  VARCHAR(200) NOT NULL,
    parent_code VARCHAR(64),
    seq_no     INT          NOT NULL DEFAULT 0,
    enabled    BOOLEAN      NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50)  NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50),
    deleted    BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_dict_item UNIQUE (dict_type, item_code),
    CONSTRAINT ck_dict_type CHECK (dict_type IN ('作战单元', '课程分类'))
);

COMMENT ON TABLE dict_item IS '字典（需求 13.9.3）。一期 3 类，其中自检 CheckList 清单项因需要快照题目文本而单独建表（开发 6.3.9）';
COMMENT ON COLUMN dict_item.dict_type IS '字典类型。自检 CheckList 清单项走 cfg_selfcheck_item，故此处只有两类';
COMMENT ON COLUMN dict_item.parent_code IS '上级分类编码。仅课程分类使用（需求 13.9.3）';
COMMENT ON COLUMN dict_item.enabled IS '启用状态。已被引用时不可删只可停用；停用不影响已引用它的历史数据（规则 DC1）';

CREATE INDEX idx_dict_type_seq ON dict_item (dict_type, seq_no) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- cfg_warning_threshold　三色灯阈值（需求 13.9.2、13.4.3）
--
-- 固定四行不可增删（需求 13.9.2）：AI需求 / 课程 / 培训计划 / 案例。初始值由 R__ 脚本装载。
-- 「预计完成时间取值字段」是只读展示项，不落库——它由 13.4.3 的对象类型固定推出。
-- -----------------------------------------------------------------------------
CREATE TABLE cfg_warning_threshold
(
    id          BIGSERIAL PRIMARY KEY,
    object_type VARCHAR(32) NOT NULL,
    blue_days   INT         NOT NULL,
    red_days    INT         NOT NULL,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  VARCHAR(50) NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  VARCHAR(50),
    deleted     BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_warning_threshold_object UNIQUE (object_type),
    CONSTRAINT ck_warning_threshold_object CHECK (object_type IN ('AI需求', '课程', '培训计划', '案例')),
    CONSTRAINT ck_warning_threshold_blue CHECK (blue_days BETWEEN 1 AND 30),
    CONSTRAINT ck_warning_threshold_red CHECK (red_days BETWEEN 1 AND 90)
);

COMMENT ON TABLE cfg_warning_threshold IS '三色灯阈值（需求 13.9.2）。固定四行，不可增删';
COMMENT ON COLUMN cfg_warning_threshold.blue_days IS '蓝灯阈值，单位天，1–30，初始值 3（需求 13.9.2）';
COMMENT ON COLUMN cfg_warning_threshold.red_days IS '红灯阈值，单位天，1–90，初始值 5（需求 13.9.2）';


-- -----------------------------------------------------------------------------
-- cfg_task_derive_rule　任务派生规则（开发 5.9.1，需求 13.1.2）
--
-- 需求 13.1.2 的 10 条派生规则。单独建配置表是因为需求注明「默认截止天数须支持后台配置」。
--
-- due_base 必须支持两种模式：13.1.2 第 2 条（课程开发）的截止时间取对象字段
-- 「课程预计发布时间」，其余 9 条是「某日 + N 天」。这个差异容易被忽略，导致课程开发
-- 任务的截止时间算错（开发 5.9.1）。
-- -----------------------------------------------------------------------------
CREATE TABLE cfg_task_derive_rule
(
    id              BIGSERIAL PRIMARY KEY,
    task_type       VARCHAR(32)  NOT NULL,
    title_template  VARCHAR(200) NOT NULL,
    owner_source    VARCHAR(32)  NOT NULL,
    due_base        VARCHAR(64)  NOT NULL,
    due_offset_days INT,
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(50)  NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by      VARCHAR(50),
    deleted         BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_task_derive_rule_type UNIQUE (task_type)
);

COMMENT ON TABLE cfg_task_derive_rule IS '任务派生规则与截止天数（开发 5.9.1）。需求 13.1.2 的 10 条规则，消费方在阶段 3';
COMMENT ON COLUMN cfg_task_derive_rule.title_template IS '任务标题模板，如「{对象名称} 待评审」';
COMMENT ON COLUMN cfg_task_derive_rule.owner_source IS '责任人来源。本期只有 OBJECT_OWNER（需求 13.1.1 第 5 项「系统派生时取对象负责人」）';
COMMENT ON COLUMN cfg_task_derive_rule.due_base IS '截止时间基准：CREATE_DATE 或 OBJECT_FIELD:字段名。第 2 条课程开发取 OBJECT_FIELD:expect_publish_date';
COMMENT ON COLUMN cfg_task_derive_rule.due_offset_days IS '偏移天数。为 NULL 时表示直接取 due_base 字段值本身';


-- -----------------------------------------------------------------------------
-- cfg_selfcheck_item　课程自检 CheckList 题库（开发 6.3.9）
--
-- 题库可后台配置，因此勾选结果必须快照题目文本，见 dtl_course_selfcheck。
-- 4 个分组、14 个检查项，其中 5 条属锁定条目不允许停用（需求 9.4.1）。
-- -----------------------------------------------------------------------------
CREATE TABLE cfg_selfcheck_item
(
    id         BIGSERIAL PRIMARY KEY,
    group_name VARCHAR(32)  NOT NULL,
    seq        INT          NOT NULL,
    item_text  VARCHAR(300) NOT NULL,
    required   BOOLEAN      NOT NULL DEFAULT TRUE,
    locked     BOOLEAN      NOT NULL DEFAULT FALSE,
    enabled    BOOLEAN      NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50)  NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50),
    deleted    BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_selfcheck_item_seq UNIQUE (seq)
);

COMMENT ON TABLE cfg_selfcheck_item IS '课程自检 CheckList 题库（开发 6.3.9）。14 条分 4 组，可后台配置';
COMMENT ON COLUMN cfg_selfcheck_item.group_name IS '所属分组，4 个（需求 9.4.1）';
COMMENT ON COLUMN cfg_selfcheck_item.required IS '是否必检。自检是纯自评、无门禁，必检项未勾选也只提示不阻断（需求 9.4）';
COMMENT ON COLUMN cfg_selfcheck_item.locked IS '锁定条目不允许停用。需求 9.4.1 列明的 5 条来自原始需求文档';

CREATE INDEX idx_selfcheck_item_group ON cfg_selfcheck_item (group_name, seq) WHERE deleted = FALSE;
