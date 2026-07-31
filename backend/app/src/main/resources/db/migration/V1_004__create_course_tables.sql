-- =============================================================================
-- V1_004__create_course_tables.sql
--
-- 阶段 1B：课程模块 9 张表。
--
-- 开发实施文档 6.2.3 列 10 张，其中 dtl_course_acceptance 已更正为 dtl_demand_acceptance
-- 并移入需求模块（见 V1_003 表头），故本模块 9 张。
--
-- 多选枚举（精品标注、评审形式、验收标准勾选）统一用 JSONB 存值数组：这些字段只做展示与
-- 「是否包含某值」的筛选，不参与聚合，也没有任何物理删除依赖，建关联表是过度设计。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- biz_course　课程主表（需求 9.3.1–9.3.3）
--
-- 双层状态建为 5 个独立列（开发 6.3.3）。需求明确「各组独立，不做组合校验」，因此
-- **不要建组合合法性约束**——子状态的赋值来自主状态转换的副作用（需求 5.3.1「子状态置 XX」）。
--
-- 不建的列：
--   过期标记  需求 9.3.1 第 12c 项明确「实时计算，不落库不建定时任务」。
--   灯色、停滞天数  同 8.3.5 S4／S5。
-- -----------------------------------------------------------------------------
CREATE TABLE biz_course
(
    id                       BIGSERIAL PRIMARY KEY,
    course_no                VARCHAR(64)  NOT NULL,
    course_name              VARCHAR(100) NOT NULL,
    review_track             VARCHAR(32)  NOT NULL,
    domain_code              VARCHAR(64)  NOT NULL,
    owner_no                 VARCHAR(50)  NOT NULL,
    deputy_id                BIGINT,
    initiated_date           DATE         NOT NULL,
    expect_publish_date      DATE         NOT NULL,
    summary                  VARCHAR(2000),
    target_audience          VARCHAR(500),
    class_hours              NUMERIC(5, 1),
    category_code            VARCHAR(64),
    validity_period          VARCHAR(16)  NOT NULL,
    validity_end_date        DATE,
    external_link            VARCHAR(500),

    main_state               VARCHAR(64)  NOT NULL,
    dev_state                VARCHAR(64),
    selfcheck_state          VARCHAR(64),
    trial_state              VARCHAR(64),
    publish_state            VARCHAR(64),
    first_publish_date       DATE,
    quality_marks            JSONB,
    close_reason             VARCHAR(500),

    current_material_version VARCHAR(32),

    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by               VARCHAR(50)  NOT NULL,
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by               VARCHAR(50),
    last_state_changed_at    TIMESTAMPTZ,
    version                  INT          NOT NULL DEFAULT 0,
    deleted                  BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_course_no UNIQUE (course_no),
    CONSTRAINT ck_course_review_track CHECK (review_track IN ('内部端到端课程', '周边领域课程')),
    CONSTRAINT ck_course_validity_period CHECK (validity_period IN ('3 个月', '6 个月', '12 个月', '长期有效')),
    CONSTRAINT ck_course_main_state CHECK (main_state IN
        ('立项', '开发', '自检', '评审决策', '试讲', '优化', '发布', '推广', '精品案例', '案例归档', '课程归档', '已关闭')),
    CONSTRAINT ck_course_dev_state CHECK (dev_state IS NULL OR dev_state IN ('待开发', '开发中', '自检中')),
    CONSTRAINT ck_course_selfcheck_state CHECK (selfcheck_state IS NULL OR selfcheck_state IN ('自检完成')),
    CONSTRAINT ck_course_trial_state CHECK (trial_state IS NULL OR trial_state IN ('待试讲', '试讲中', '待发布')),
    CONSTRAINT ck_course_publish_state CHECK (publish_state IS NULL OR publish_state IN ('已发布'))
);

COMMENT ON TABLE biz_course IS '课程主表（需求第 9 章）。主状态 + 4 组子状态，本项目流程最复杂的模块';
COMMENT ON COLUMN biz_course.course_no IS '课程ID，规则：KC + 年月 + 4 位流水';
COMMENT ON COLUMN biz_course.review_track IS '评审轨道。由线下评审会判定后录入，允许中途修改（需求议题 8）';
COMMENT ON COLUMN biz_course.deputy_id IS '代理人。V1.2 删除代理机制（N19），保留此列但不写入';
COMMENT ON COLUMN biz_course.expect_publish_date IS '预计发布时间。三色灯判定基准（IX-3），同时是课程开发任务的截止时间来源（cfg_task_derive_rule.due_base = OBJECT_FIELD:expect_publish_date）';
COMMENT ON COLUMN biz_course.class_hours IS '课时（小时），支持 0.5 步进';
COMMENT ON COLUMN biz_course.validity_period IS '课程有效期（C07）。立项时即需选定，可随时修改';
COMMENT ON COLUMN biz_course.validity_end_date IS '有效期截止日 = 首次发布时间 + 有效期时长；选「长期有效」时为 NULL（需求 9.3.1 第 12b 项）';
COMMENT ON COLUMN biz_course.external_link IS '课程外部链接（D10）。课程视频与直播一律填外链，平台不上传视频文件（N22）';
COMMENT ON COLUMN biz_course.selfcheck_state IS '课程自检状态。仅「自检完成」一个非空值，取消自检时置回 NULL（需求 5.4.2）';
COMMENT ON COLUMN biz_course.first_publish_date IS '首次发布时间。既是课程开发周期的终点，也是有效期的起算点（规则 EX1）';
COMMENT ON COLUMN biz_course.quality_marks IS '精品标注，多选枚举的值数组：推荐 / 重要 / 精品。由线下评审决定后标注（需求议题 26）';
COMMENT ON COLUMN biz_course.last_state_changed_at IS '最后状态变更时间（需求 C5）。五个状态列任一发生变化都要更新它';

CREATE INDEX idx_course_main_state ON biz_course (main_state) WHERE deleted = FALSE;
CREATE INDEX idx_course_dev_state ON biz_course (dev_state) WHERE deleted = FALSE;
CREATE INDEX idx_course_trial_state ON biz_course (trial_state) WHERE deleted = FALSE;
CREATE INDEX idx_course_light ON biz_course (expect_publish_date, last_state_changed_at) WHERE deleted = FALSE;
CREATE INDEX idx_course_owner ON biz_course (owner_no) WHERE deleted = FALSE;
CREATE INDEX idx_course_domain ON biz_course (domain_code) WHERE deleted = FALSE;
CREATE INDEX idx_course_name_trgm ON biz_course USING GIN (course_name gin_trgm_ops);

-- rel_demand_course.course_id 的外键在此补齐（V1_003 建表时 biz_course 尚不存在）
ALTER TABLE rel_demand_course
    ADD CONSTRAINT fk_rel_dc_course FOREIGN KEY (course_id) REFERENCES biz_course (id);


-- -----------------------------------------------------------------------------
-- dtl_course_material　课程材料当前版本（需求 9.3.3，开发 6.2.3）
--
-- 课件 / 教案 / 实验材料三类附件的当前引用。课程材料不走 sys_attachment_ref 而用这张
-- 专表，因为开发 6.2.3 明确给了这张表，且材料要参与版本快照（R7）。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_course_material
(
    id            BIGSERIAL PRIMARY KEY,
    course_id     BIGINT      NOT NULL REFERENCES biz_course (id),
    material_type VARCHAR(16) NOT NULL,
    attachment_id BIGINT      NOT NULL REFERENCES sys_attachment (id),
    seq_no        INT         NOT NULL DEFAULT 0,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(50) NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by    VARCHAR(50),
    deleted       BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_course_material_type CHECK (material_type IN ('课件', '教案', '实验材料'))
);

COMMENT ON TABLE dtl_course_material IS '课程材料当前版本（需求 9.3.3）。指向附件，三类材料都支持多附件';
COMMENT ON COLUMN dtl_course_material.material_type IS '材料类型。课件单文件上限 200MB，其余 20MB（规则 F1）';

CREATE INDEX idx_course_material_course ON dtl_course_material (course_id, material_type) WHERE deleted = FALSE;
CREATE INDEX idx_course_material_attachment ON dtl_course_material (attachment_id) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_course_material_version　材料版本快照（规则 R7，开发 6.2.3）
--
-- 提交评审时自动生成。评审记录绑定版本，保证「一年后翻开这条评审记录，看到的是当时评的
-- 那份材料」——这是 F5「附件逻辑删除不物理删除」的直接原因。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_course_material_version
(
    id         BIGSERIAL PRIMARY KEY,
    course_id  BIGINT      NOT NULL REFERENCES biz_course (id),
    version_no VARCHAR(32) NOT NULL,
    remark     VARCHAR(500),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50),
    deleted    BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_course_material_version UNIQUE (course_id, version_no)
);

COMMENT ON TABLE dtl_course_material_version IS '材料版本快照（规则 R7）。提交评审时自动生成，版本号规则见需求 9.5';

CREATE INDEX idx_material_version_course ON dtl_course_material_version (course_id) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_course_material_version_file　版本内的文件明细（开发 6.2.3）
--
-- file_name_snapshot 是刻意的冗余：附件被逻辑删除后，历史版本仍应显示「当时这个版本里
-- 有哪些文件」，这与签到快照姓名（6.3.6）、自检快照题目（6.3.9）是同一类判断。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_course_material_version_file
(
    id                 BIGSERIAL PRIMARY KEY,
    version_id         BIGINT       NOT NULL REFERENCES dtl_course_material_version (id),
    material_type      VARCHAR(16)  NOT NULL,
    attachment_id      BIGINT       NOT NULL REFERENCES sys_attachment (id),
    file_name_snapshot VARCHAR(255) NOT NULL,
    seq_no             INT          NOT NULL DEFAULT 0,

    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(50)  NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by         VARCHAR(50),
    deleted            BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_version_file_material_type CHECK (material_type IN ('课件', '教案', '实验材料'))
);

COMMENT ON TABLE dtl_course_material_version_file IS '版本内的文件明细（规则 R7）';
COMMENT ON COLUMN dtl_course_material_version_file.file_name_snapshot IS '文件名快照。附件被逻辑删除后历史版本仍要能显示当时有哪些文件';

CREATE INDEX idx_version_file_version ON dtl_course_material_version_file (version_id) WHERE deleted = FALSE;
CREATE INDEX idx_version_file_attachment ON dtl_course_material_version_file (attachment_id) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_course_review　课程评审记录（需求 9.6.1，规则 R5、R7）
--
-- 唯一约束 (course_id, round_no) 是数据库层的最后一道防线（开发 6.3.5、5.10）：
-- 同一课程的两次「提交评审」并发时，轮次计算即使用 SELECT ... FOR UPDATE 锁了课程行，
-- 这条约束仍要建——成本为零。
--
-- 记录状态是一个状态机（需求 5.5），因此本表有 last_state_changed_at。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_course_review
(
    id                    BIGSERIAL PRIMARY KEY,
    course_id             BIGINT       NOT NULL REFERENCES biz_course (id),
    round_no              INT          NOT NULL,
    version_id            BIGINT       REFERENCES dtl_course_material_version (id),
    bound_version_no      VARCHAR(32),
    review_forms          JSONB,
    review_date           DATE         NOT NULL,
    participants          VARCHAR(500),
    review_result         VARCHAR(64),
    review_opinion        VARCHAR(5000),
    issue_list            VARCHAR(5000),
    record_state          VARCHAR(64)  NOT NULL,

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    last_state_changed_at TIMESTAMPTZ,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_course_review_round UNIQUE (course_id, round_no),
    CONSTRAINT ck_course_review_result CHECK (review_result IS NULL OR review_result IN
        ('通过', '不通过·修改后重新评审', '不通过·关闭课程开发')),
    CONSTRAINT ck_course_review_record_state CHECK (record_state IN ('待录入结论', '已完成'))
);

COMMENT ON TABLE dtl_course_review IS '课程评审记录（需求 9.6.1）。多轮独立留档，不设上限（规则 R5）';
COMMENT ON COLUMN dtl_course_review.round_no IS '评审轮次 = 该课程已有评审记录数 + 1。唯一约束防并发产生重复轮次（开发 6.3.5）';
COMMENT ON COLUMN dtl_course_review.bound_version_no IS '绑定材料版本号的快照，如 V1、V2。version_id 是关联，这一列是展示用的冗余';
COMMENT ON COLUMN dtl_course_review.review_forms IS '评审形式，多选枚举值数组：线上会议 / 线下会议 / 邮件 / WeLink / 单独评审 / 集体评审';
COMMENT ON COLUMN dtl_course_review.participants IS '参与评审人员。文本录入，不做人员关联与人数校验（需求议题 10）';
COMMENT ON COLUMN dtl_course_review.review_result IS '评审结果，驱动课程主状态转换（需求 5.5）。记录状态为「待录入结论」时为 NULL';

CREATE INDEX idx_course_review_course ON dtl_course_review (course_id) WHERE deleted = FALSE;
CREATE INDEX idx_course_review_state ON dtl_course_review (record_state) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_course_trial　试讲记录（需求 9.7.1，规则 R6）
--
-- 结论不一致标记用生成列而非应用层维护（开发 6.3.4），可以保证标记永不与数据脱节，
-- 且 13.3.1 的筛选条件里有这个标记，生成列可以直接建索引。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_course_trial
(
    id                    BIGSERIAL PRIMARY KEY,
    course_id             BIGINT       NOT NULL REFERENCES biz_course (id),
    round_no              INT          NOT NULL,
    trial_date            DATE         NOT NULL,
    lecturer_id           BIGINT       NOT NULL,
    participants          VARCHAR(500),
    acceptance_checks     JSONB,
    course_conclusion     VARCHAR(16),
    lecturer_conclusion   VARCHAR(16),
    inconsistent          BOOLEAN GENERATED ALWAYS AS (
                              course_conclusion IS NOT NULL AND lecturer_conclusion IS NOT NULL
                                  AND course_conclusion <> lecturer_conclusion
                              ) STORED,
    expert_opinion        VARCHAR(5000),
    issue_list            VARCHAR(5000),
    record_state          VARCHAR(64)  NOT NULL,

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    last_state_changed_at TIMESTAMPTZ,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_course_trial_round UNIQUE (course_id, round_no),
    CONSTRAINT ck_trial_course_conclusion CHECK (course_conclusion IS NULL OR course_conclusion IN ('合格', '不合格')),
    CONSTRAINT ck_trial_lecturer_conclusion CHECK (lecturer_conclusion IS NULL OR lecturer_conclusion IN ('合格', '不合格')),
    CONSTRAINT ck_course_trial_record_state CHECK (record_state IN ('待录入结论', '已完成'))
);

COMMENT ON TABLE dtl_course_trial IS '试讲记录（需求 9.7.1）。双结论 + 不一致标记（规则 R6、13.3.1）';
COMMENT ON COLUMN dtl_course_trial.lecturer_id IS '试讲讲师，从讲师池选。外键在 V1_005 建 biz_lecturer 后补';
COMMENT ON COLUMN dtl_course_trial.acceptance_checks IS '验收标准勾选，按评审轨道动态展示（需求 9.7.2）';
COMMENT ON COLUMN dtl_course_trial.course_conclusion IS '课程试讲结论，驱动课程主状态';
COMMENT ON COLUMN dtl_course_trial.lecturer_conclusion IS '讲师试讲结论，驱动讲师试讲合格标记。与课程结论相互独立';
COMMENT ON COLUMN dtl_course_trial.inconsistent IS '结论不一致标记。生成列，不手工维护（开发 6.3.4）';

CREATE INDEX idx_course_trial_course ON dtl_course_trial (course_id) WHERE deleted = FALSE;
CREATE INDEX idx_course_trial_lecturer ON dtl_course_trial (lecturer_id) WHERE deleted = FALSE;
CREATE INDEX idx_course_trial_inconsistent ON dtl_course_trial (inconsistent) WHERE deleted = FALSE AND inconsistent = TRUE;
CREATE INDEX idx_course_trial_record_state ON dtl_course_trial (record_state) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_trial_feedback　试讲反馈（需求 9.7a.1，规则 R9、R10）
--
-- 与正式培训的学员反馈（dtl_training_feedback）是两张独立的表：试讲的听众是评审专家与少量
-- 试听学员，人数少、目的是发现课程问题；正式培训的听众是目标学员，人数多、目的是评价授课
-- 效果。混在一张表里会让「讲师平均评分」这个指标失去意义（需求 9.7a 表末说明）。
--
-- 匿名必须在写入时落实：submitter_no 直接存 NULL，不是「照常存工号只在界面隐藏」
-- （开发 5.6.3 细节七）。这条一旦做错无法补救——数据已经落库了。出口准则 E1-7 直接查库验证。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_trial_feedback
(
    id              BIGSERIAL PRIMARY KEY,
    trial_id        BIGINT       NOT NULL REFERENCES dtl_course_trial (id),
    submitter_no    VARCHAR(50),
    submitter_name  VARCHAR(50),
    score           INT          NOT NULL,
    content         VARCHAR(2000),
    import_batch_no VARCHAR(64)  NOT NULL,
    imported_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(50)  NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by      VARCHAR(50),
    deleted         BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_trial_feedback_score CHECK (score BETWEEN 1 AND 5)
);

COMMENT ON TABLE dtl_trial_feedback IS '试讲反馈（需求 9.7a.1）。评分不计入讲师平均评分（规则 R10），只在本轮试讲内统计';
COMMENT ON COLUMN dtl_trial_feedback.submitter_no IS '反馈人工号。匿名时写入 NULL，不是存了再隐藏（开发 5.6.3 细节七、出口准则 E1-7）';
COMMENT ON COLUMN dtl_trial_feedback.submitter_name IS '反馈人姓名。有工号时从人员表带出；匿名时为 NULL';
COMMENT ON COLUMN dtl_trial_feedback.import_batch_no IS '导入批次号。唯一录入方式是导入，界面无手工新增入口（需求 9.7a.2 第 4 项）。匿名行也保留它用于对账';

CREATE INDEX idx_trial_feedback_trial ON dtl_trial_feedback (trial_id) WHERE deleted = FALSE;
CREATE INDEX idx_trial_feedback_batch ON dtl_trial_feedback (import_batch_no) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_course_selfcheck　自检 CheckList 勾选结果（开发 6.3.9）
--
-- item_text_snapshot 不是冗余，是自检记录能否作为证据的关键。只存 item_id 的话，业务方把
-- 第 7 题从「课件是否包含实操截图」改成「课件是否包含实操视频」之后，去年那门课的自检记录
-- 会显示「已勾选：课件是否包含实操视频」——而开发者当时勾的根本不是这一条。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_course_selfcheck
(
    id                 BIGSERIAL PRIMARY KEY,
    course_id          BIGINT       NOT NULL REFERENCES biz_course (id),
    item_id            BIGINT       NOT NULL REFERENCES cfg_selfcheck_item (id),
    item_text_snapshot VARCHAR(300) NOT NULL,
    checked            BOOLEAN      NOT NULL,
    note               VARCHAR(500),

    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(50)  NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by         VARCHAR(50),
    deleted            BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_course_selfcheck UNIQUE (course_id, item_id)
);

COMMENT ON TABLE dtl_course_selfcheck IS '课程自检勾选结果（开发 6.3.9）。纯自评、无门禁、无不通过分支（需求 9.4）';
COMMENT ON COLUMN dtl_course_selfcheck.item_id IS '指向题库，仅供追溯。展示一律用 item_text_snapshot';
COMMENT ON COLUMN dtl_course_selfcheck.item_text_snapshot IS '勾选当时的题目原文。题库改动后历史记录不得漂移（开发 6.3.9）';
COMMENT ON COLUMN dtl_course_selfcheck.note IS '备注。需求 9.4.1 第 1 题要求「勾选 + 必填原因文本」，原因写在此列';

CREATE INDEX idx_course_selfcheck_course ON dtl_course_selfcheck (course_id) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_course_schedule　课程排期（需求 9.9）
--
-- 排期对象是「课程的计划开发节点与计划发布时间」。课程排期与培训排期是两个独立功能，
-- 前者排课程开发节点，后者排培训场次；**排课三项校验只作用于培训场次创建（11.4），
-- 课程排期本身不做校验**（需求 9.9）。
--
-- **需求 9.9 只给了排期对象与上游依赖，没有给字段清单，本表字段属推导。** 人工验收时需
-- 确认，已记入待修文档清单。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_course_schedule
(
    id         BIGSERIAL PRIMARY KEY,
    course_id  BIGINT       NOT NULL REFERENCES biz_course (id),
    node_name  VARCHAR(100) NOT NULL,
    plan_date  DATE         NOT NULL,
    remark     VARCHAR(500),

    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50)  NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50),
    deleted    BOOLEAN      NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE dtl_course_schedule IS '课程排期（需求 9.9）。日历形式展示课程的计划开发节点与计划发布时间';
COMMENT ON COLUMN dtl_course_schedule.node_name IS '排期节点名称，如「完成初稿」「提交评审」';
COMMENT ON COLUMN dtl_course_schedule.plan_date IS '计划日期。DATE 而非时间戳——排期日历按自然日展示（6.1.4）';

CREATE INDEX idx_course_schedule_course ON dtl_course_schedule (course_id) WHERE deleted = FALSE;
CREATE INDEX idx_course_schedule_date ON dtl_course_schedule (plan_date) WHERE deleted = FALSE;
