-- =============================================================================
-- V1_007__create_case_tables.sql
--
-- 阶段 1B：案例模块 5 张表（开发实施文档 6.2.6）。
--
-- 不要建 dtl_case_favorite —— 收藏功能取消（N21），需求 12.3 第 20 项「收藏数」也已删除。
--
-- 沿用前两个脚本的决策：浏览次数、点赞量、评论数、累计阅读时长四项不落库，由三张互动明细
-- 表 COUNT／SUM 得出。这四项在需求 12.3 里标为「A 系统自动生成」，但 15.5 给了它们的公式，
-- 且互动明细表本身就是唯一真相——存一份计数器只会与明细漂移。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- biz_case　案例主表（需求 12.3）
--
-- 案例与课程的 1:1 关系放在案例侧（开发 6.3.7）：关系字段是 biz_case.course_id，可空、唯一，
-- 不放在课程侧。理由是不是所有案例都必须来自课程（业务上可能有独立案例），而每个由课程派生
-- 的案例必然对应一门课程。
--
-- 审核四个字段（审核人、审核时间、审核意见、审核结论）直接放主表且不建历史表：需求 12.3
-- 第 9d 项明确「后一次审核覆盖前一次，不记轮次」（C09 第 4 条）。这与需求业务验收要记轮次
-- （dtl_demand_acceptance）刚好相反，不要把两者做成一样。
-- -----------------------------------------------------------------------------
CREATE TABLE biz_case
(
    id                    BIGSERIAL PRIMARY KEY,
    case_no               VARCHAR(64)  NOT NULL,
    case_name             VARCHAR(100) NOT NULL,
    course_id             BIGINT       REFERENCES biz_course (id),
    contributing_org      VARCHAR(100) NOT NULL,
    contributors          JSONB,
    domain_codes          JSONB        NOT NULL,
    owner_no              VARCHAR(50)  NOT NULL,
    deputy_id             BIGINT,

    case_state            VARCHAR(64)  NOT NULL,
    reviewer_no           VARCHAR(50),
    reviewed_at           DATE,
    review_opinion        VARCHAR(500),
    review_result         VARCHAR(16),

    quality_marks         JSONB,
    content               TEXT,
    published_at          TIMESTAMPTZ,
    expect_publish_date   DATE,

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    last_state_changed_at TIMESTAMPTZ,
    version               INT          NOT NULL DEFAULT 0,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_case_no UNIQUE (case_no),
    CONSTRAINT uk_case_course UNIQUE (course_id),
    CONSTRAINT ck_case_state CHECK (case_state IN ('待整理', '整理中', '待审核', '已上架')),
    CONSTRAINT ck_case_review_result CHECK (review_result IS NULL OR review_result IN ('通过', '不通过'))
);

COMMENT ON TABLE biz_case IS '案例主表（需求第 12 章）。由课程标注达精品时自动创建（需求 5.3.1 第 12 条）';
COMMENT ON COLUMN biz_case.case_no IS '案例ID，规则：AL + 年月 + 3 位流水';
COMMENT ON COLUMN biz_case.course_id IS '来源课程ID，可空且唯一（开发 6.3.7）。一期案例仅来自精品课程（需求议题 27）';
COMMENT ON COLUMN biz_case.contributing_org IS '贡献组织。V1.2 由「部门选择」改为自由文本（N18），多个组织用逗号分隔';
COMMENT ON COLUMN biz_case.domain_codes IS '应用领域，多选枚举值数组，取自作战单元字典';
COMMENT ON COLUMN biz_case.owner_no IS '案例负责人工号，默认取来源课程负责人。V1.2 起仅为数据字段，不决定权限';
COMMENT ON COLUMN biz_case.deputy_id IS '代理人。V1.2 删除代理机制（N19），保留此列但不写入';
COMMENT ON COLUMN biz_case.case_state IS '案例状态（需求 5.9）。V1.2 新增「待审核」态（C09）。上架前必须审核通过，是 C9 三处硬阻断之一';
COMMENT ON COLUMN biz_case.review_result IS '审核结论。后一次审核覆盖前一次，不记轮次（C09 第 4 条）';
COMMENT ON COLUMN biz_case.content IS '案例正文，富文本，≤20000 字。上架时必填';
COMMENT ON COLUMN biz_case.published_at IS '上架时间。状态首次变为「已上架」时写入，是案例上架周期的终点（需求 12.3 第 15 项）';
COMMENT ON COLUMN biz_case.expect_publish_date IS '预计上架时间。三色灯蓝灯与黄灯的判定基准（IX-3）';

CREATE INDEX idx_case_state ON biz_case (case_state) WHERE deleted = FALSE;
CREATE INDEX idx_case_light ON biz_case (expect_publish_date, last_state_changed_at) WHERE deleted = FALSE;
CREATE INDEX idx_case_owner ON biz_case (owner_no) WHERE deleted = FALSE;
CREATE INDEX idx_case_name_trgm ON biz_case USING GIN (case_name gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- dtl_case_view　浏览记录（需求 12.4、15.5）
--
-- V1.0 名为 dtl_case_read，改名不是洁癖：表名叫 read 会让后续开发下意识地写去重逻辑
-- （「同一人读过就不再记」），而需求 12.4 明确要求**不去重**。改成 view 让表名本身传达
-- 「这是 PV 流水」（开发 6.2.6）。同理字段名用 viewed_at 而非 read_date。
--
-- 这是唯一会到十万级的业务表，IX-8 为它指定了 (case_id, viewed_at) 索引。
-- 追加写、不删除，因此不套公共字段模板中的 updated／deleted 部分。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_case_view
(
    id               BIGSERIAL PRIMARY KEY,
    case_id          BIGINT      NOT NULL REFERENCES biz_case (id),
    viewer_no        VARCHAR(50),
    viewed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INT
);

COMMENT ON TABLE dtl_case_view IS '案例浏览记录（需求 12.4）。PV 流水，不去重——每次打开详情页记一条';
COMMENT ON COLUMN dtl_case_view.viewer_no IS '浏览人工号。用户账号为只读账号，此列可能为空';
COMMENT ON COLUMN dtl_case_view.duration_seconds IS '停留时长（秒）。「累计阅读时长」与「平均阅读时长」由本列 SUM／AVG 得出（需求 12.3 第 21 项）';

-- IX-8：浏览次数与「近 30 天活跃案例」两个指标都依赖它
CREATE INDEX idx_case_view_case_time ON dtl_case_view (case_id, viewed_at);


-- -----------------------------------------------------------------------------
-- dtl_case_like　点赞（需求 12.4、15.5）
--
-- 每次点击记一条，**不去重、不可取消**（需求 12.3 第 18 项）。因此没有唯一约束，也没有
-- 「取消点赞」的删除路径——这与常见的点赞实现相反，是业务明确要求的。
--
-- 点赞是用户账号唯二的写接口之一（另一个是评论，需求 6.2.5），因此它的 audit_op_log
-- 记录里会出现 account_type = 'USER'。
--
-- 与 dtl_case_view 同为追加写流水，没有更新与删除路径，因此不套公共字段模板的
-- updated／deleted 部分。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_case_like
(
    id       BIGSERIAL PRIMARY KEY,
    case_id  BIGINT      NOT NULL REFERENCES biz_case (id),
    liker_no VARCHAR(50),
    liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dtl_case_like IS '案例点赞（需求 12.4）。累计计数，不去重、不可取消——刻意不建唯一约束';

CREATE INDEX idx_case_like_case ON dtl_case_like (case_id, liked_at);


-- -----------------------------------------------------------------------------
-- dtl_case_comment　评论（需求 12.4、15.5）
--
-- 评论数「不含已逻辑删除的评论」（需求 12.3 第 19 项），因此本表要有 deleted 列，
-- 且计数查询必须带 WHERE deleted = FALSE。
--
-- 删除评论是破坏性操作，二次确认弹窗中的选填「操作人」写入 audit_op_log.remark
-- （开发 5.2.4）。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_case_comment
(
    id           BIGSERIAL PRIMARY KEY,
    case_id      BIGINT        NOT NULL REFERENCES biz_case (id),
    commenter_no VARCHAR(50),
    content      VARCHAR(2000) NOT NULL,
    commented_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by   VARCHAR(50)   NOT NULL,
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_by   VARCHAR(50),
    deleted      BOOLEAN       NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE dtl_case_comment IS '案例评论（需求 12.4）。评论是用户账号唯二的写接口之一（需求 6.2.5）';
COMMENT ON COLUMN dtl_case_comment.deleted IS '逻辑删除。评论数不含已删除的评论（需求 12.3 第 19 项）';

CREATE INDEX idx_case_comment_case ON dtl_case_comment (case_id, commented_at) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_case_report　总结报告（需求 12.6）
--
-- **需求 12.6 描述的是页面与生成／编辑入口，没有给字段清单**，本表字段属推导。
-- 已记入待修文档清单。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_case_report
(
    id            BIGSERIAL PRIMARY KEY,
    report_name   VARCHAR(200) NOT NULL,
    report_period VARCHAR(32),
    content       TEXT,
    remark        VARCHAR(500),

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(50)  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by    VARCHAR(50),
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE dtl_case_report IS '案例总结报告（需求 12.6）。运营生成与编辑，用户账号只读（需求 6.2 第 9 项）';
COMMENT ON COLUMN dtl_case_report.report_period IS '报告期间，如 2026-H1、2026-07';

CREATE INDEX idx_case_report_period ON dtl_case_report (report_period) WHERE deleted = FALSE;
