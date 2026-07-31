-- =============================================================================
-- V1_003__create_demand_tables.sql
--
-- 阶段 1B：AI需求模块 5 张表。
--
-- 开发实施文档 6.2.2 列的是 4 张（biz_demand、dtl_demand_review、rel_demand_course、
-- biz_value_report）。业务验收记录表在 6.2.3 被误列到课程模块、误名为 dtl_course_acceptance——
-- 业务验收是需求 5.2.5 的环节，需求详情页才有「业务验收」页签（需求 8.2），课程没有验收概念。
-- 这里更正为 dtl_demand_acceptance 并归入本模块：需求 4→5 张、课程 10→9 张，总数不变。
-- 已记入待修文档清单。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- biz_demand　需求主表（需求 8.3.1–8.3.4）
--
-- 五个状态字段，也就是五个状态机（需求 5.13 清单第 1～5 项、开发 6.3.2）。反模式是用一个
-- state 字段承载全部状态值——那样「已评审」与「开发中」就无法共存，而业务上需求评审完成后
-- 进入开发是两个状态并行的。
--
-- 不建的列：
--   reuse_tool_name  出口三已取消（需求附录 A 第 1 项），留一个永不写入的列会让后来者
--                    以为出口三仍在。
--   灯色、停滞天数    需求 8.3.5 S4／S5 明确实时计算（13.4.4），不落库。
--
-- 交付与归档只有 delivery_mark 一列，不建两个布尔列。需求 8.3.4 第 28、35 项写作「交付使用
-- 标记 / 归档标记」两个布尔，但需求 5.13 第 5 项把它们归为**一个**状态机「需求交付标记」，
-- 1A 的引擎也实现为「已交付 → 已归档」（DemandStateMachines.deliveryMark）。界面的两个
-- 布尔是这一列的表示：交付使用标记=是 等价于 delivery_mark ∈ (已交付, 已归档)，
-- 归档标记=是 等价于 delivery_mark = 已归档。**拆成两列会与状态机脱钩**，转换时要维护两处。
-- -----------------------------------------------------------------------------
CREATE TABLE biz_demand
(
    id                    BIGSERIAL PRIMARY KEY,
    demand_no             VARCHAR(64)  NOT NULL,
    demand_name           VARCHAR(100) NOT NULL,
    domain_code           VARCHAR(64)  NOT NULL,
    proposer_no           VARCHAR(50)  NOT NULL,
    proposer_dept         VARCHAR(50),
    owner_no              VARCHAR(50)  NOT NULL,
    deputy_id             BIGINT,
    proposed_date         DATE         NOT NULL,
    expect_finish_date    DATE         NOT NULL,
    description           VARCHAR(2000) NOT NULL,
    demand_source         VARCHAR(32),
    demand_type           VARCHAR(32),
    priority              VARCHAR(8),

    review_state          VARCHAR(64)  NOT NULL,
    review_date           DATE,
    review_conclusion     VARCHAR(1000),
    review_opinion        VARCHAR(2000),

    outlet                VARCHAR(64),
    solution_state        VARCHAR(64),
    solution_name         VARCHAR(200),
    dev_state             VARCHAR(64),
    first_online_date     DATE,
    latest_online_date    DATE,
    optimize_count        INT          NOT NULL DEFAULT 0,

    delivery_mark         VARCHAR(64),
    delivered_at          DATE,
    archived_at           DATE,
    acceptance_state      VARCHAR(64),
    acceptor_name         VARCHAR(50),
    accepted_at           DATE,
    acceptance_opinion    VARCHAR(1000),
    acceptance_round      INT          NOT NULL DEFAULT 0,

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    last_state_changed_at TIMESTAMPTZ,
    version               INT          NOT NULL DEFAULT 0,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_demand_no UNIQUE (demand_no),
    CONSTRAINT ck_demand_source CHECK (demand_source IS NULL OR demand_source IN ('部门提出', '个人提出', '培训反馈', '案例反推', '战略任务')),
    CONSTRAINT ck_demand_type CHECK (demand_type IS NULL OR demand_type IN ('效率提升', '质量改善', '成本降低', '风险控制', '体验优化')),
    CONSTRAINT ck_demand_priority CHECK (priority IS NULL OR priority IN ('高', '中', '低')),
    CONSTRAINT ck_demand_review_state CHECK (review_state IN ('待评审', '评审中', '已评审')),
    CONSTRAINT ck_demand_outlet CHECK (outlet IS NULL OR outlet IN ('用现有工具输出解决方案', '造工具需求开发')),
    CONSTRAINT ck_demand_solution_state CHECK (solution_state IS NULL OR solution_state IN ('已输出', '已发布')),
    CONSTRAINT ck_demand_dev_state CHECK (dev_state IS NULL OR dev_state IN ('已立项', '待开发', '开发中', '已上线', '优化中')),
    CONSTRAINT ck_demand_delivery_mark CHECK (delivery_mark IS NULL OR delivery_mark IN ('已交付', '已归档')),
    CONSTRAINT ck_demand_acceptance_state CHECK (acceptance_state IS NULL OR acceptance_state IN ('待验收', '验收通过', '验收不通过'))
);

COMMENT ON TABLE biz_demand IS 'AI需求主表（需求第 8 章）。含分流出口 + 五个状态字段';
COMMENT ON COLUMN biz_demand.demand_no IS '需求ID，规则：XQ + 年月 + 4 位流水，如 XQ2026070001';
COMMENT ON COLUMN biz_demand.domain_code IS '所属领域，取作战单元字典的编码。含义是「属于哪条业务线」，不是「关联了哪门课程」（需求 13.9.3 口径提醒）';
COMMENT ON COLUMN biz_demand.proposer_dept IS '提出人部门，随提出人自动带出的快照文本';
COMMENT ON COLUMN biz_demand.owner_no IS '负责人工号。V1.2 起仅为数据字段，不决定权限（需求 6.1.3、C04）。不要在权限代码里读它';
COMMENT ON COLUMN biz_demand.deputy_id IS '代理人。V1.2 删除代理机制（N19），保留此列但界面不展示、不写入（需求 8.3.1 第 7 项）';
COMMENT ON COLUMN biz_demand.expect_finish_date IS '预计开发完成时间。三色灯蓝灯与黄灯的判定基准（IX-3）';
COMMENT ON COLUMN biz_demand.outlet IS '分流出口，仅两值——「已有工具可直接复用」的出口三已取消（C01）';
COMMENT ON COLUMN biz_demand.solution_state IS '解决方案状态，出口一专用，其余为 NULL（状态机见需求 5.2.3）';
COMMENT ON COLUMN biz_demand.dev_state IS '需求开发状态，出口二专用，其余为 NULL（状态机见需求 5.2.4）';
COMMENT ON COLUMN biz_demand.first_online_date IS '首次上线时间。状态首次变为「已上线」时写入，效率指标取此值（需求 E1）';
COMMENT ON COLUMN biz_demand.delivery_mark IS '需求交付标记（需求 5.13 第 5 项）。已交付 → 已归档，是一个状态机，不是两个布尔标记';
COMMENT ON COLUMN biz_demand.acceptance_state IS '业务验收状态（需求 5.2.5，C06）。标记交付使用后置「待验收」';
COMMENT ON COLUMN biz_demand.acceptor_name IS '验收人。自由填写文本，不关联人员表——业务接口人可能不在人员表内（需求 5.2.5 第 2 条）';
COMMENT ON COLUMN biz_demand.acceptance_round IS '验收轮次。每次从「验收不通过」重新提交时 +1，不设上限（需求 5.2.5 第 4 行）';
COMMENT ON COLUMN biz_demand.updated_at IS '最后编辑时间（需求 C6）。任意字段修改时更新，不参与预警';
COMMENT ON COLUMN biz_demand.last_state_changed_at IS '最后状态变更时间（需求 C5）。红灯停滞判定的唯一依据，只有状态值变化才更新';
COMMENT ON COLUMN biz_demand.version IS '乐观锁版本号（规则 K1）。仅需求／课程／案例三表有此列，不要扩大范围';

-- IX-2：五类主对象的状态列建索引，列表页默认按状态筛选
CREATE INDEX idx_demand_review_state ON biz_demand (review_state) WHERE deleted = FALSE;
CREATE INDEX idx_demand_dev_state ON biz_demand (dev_state) WHERE deleted = FALSE;
CREATE INDEX idx_demand_acceptance_state ON biz_demand (acceptance_state) WHERE deleted = FALSE;
-- IX-3：三色灯筛选依赖这两列
CREATE INDEX idx_demand_light ON biz_demand (expect_finish_date, last_state_changed_at) WHERE deleted = FALSE;
-- IX-1（V1.1 改理由后保留）：任务中心「按负责人查看」下拉筛选
CREATE INDEX idx_demand_owner ON biz_demand (owner_no) WHERE deleted = FALSE;
CREATE INDEX idx_demand_domain ON biz_demand (domain_code) WHERE deleted = FALSE;
-- 名称模糊搜索走 GIN + pg_trgm，一期不引搜索引擎（16.1.5、开发 3.3）
CREATE INDEX idx_demand_name_trgm ON biz_demand USING GIN (demand_name gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- dtl_demand_review　需求评审记录（开发 6.2.2）
--
-- 需求文档没有给这张表的字段清单：8.3.2「评审信息」把评审字段直接挂在需求主表上。但
-- 需求 5.2.1 有「重新评审」转换（已评审 → 评审中），意味着一个需求会有多轮评审，主表只能
-- 存最新一轮。因此本表按 8.3.2 的字段镜像 + 轮次建模，主表存当前值、本表存历史。
--
-- **字段清单属推导而非照抄，人工验收时需确认。** 已记入待修文档清单（需求文档缺 8.x 需求
-- 评审记录字段清单）。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_demand_review
(
    id                BIGSERIAL PRIMARY KEY,
    demand_id         BIGINT       NOT NULL REFERENCES biz_demand (id),
    round_no          INT          NOT NULL,
    review_date       DATE,
    review_conclusion VARCHAR(1000),
    review_opinion    VARCHAR(2000),

    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(50)  NOT NULL,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by        VARCHAR(50),
    deleted           BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_demand_review_round UNIQUE (demand_id, round_no)
);

COMMENT ON TABLE dtl_demand_review IS '需求评审记录。多轮评审的历史留档，字段按需求 8.3.2 推导';
COMMENT ON COLUMN dtl_demand_review.round_no IS '评审轮次。唯一约束防并发产生重复轮次（同开发 6.3.5 的做法）';

CREATE INDEX idx_demand_review_demand ON dtl_demand_review (demand_id) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_demand_acceptance　业务验收记录（需求 5.2.5、8.3.4）
--
-- 需求 5.2.5 第 4 行：「可反复验收，不设轮次上限」。主表 biz_demand 存当前验收状态与最新
-- 结论，本表存每一轮的历史。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_demand_acceptance
(
    id                 BIGSERIAL PRIMARY KEY,
    demand_id          BIGINT       NOT NULL REFERENCES biz_demand (id),
    round_no           INT          NOT NULL,
    acceptor_name      VARCHAR(50)  NOT NULL,
    accepted_at        DATE         NOT NULL,
    acceptance_result  VARCHAR(16)  NOT NULL,
    acceptance_opinion VARCHAR(1000),

    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(50)  NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by         VARCHAR(50),
    deleted            BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_demand_acceptance_round UNIQUE (demand_id, round_no),
    CONSTRAINT ck_demand_acceptance_result CHECK (acceptance_result IN ('通过', '不通过'))
);

COMMENT ON TABLE dtl_demand_acceptance IS '业务验收记录（需求 5.2.5）。验收发生在线下，平台只记录结论';
COMMENT ON COLUMN dtl_demand_acceptance.acceptor_name IS '验收人，自由填写文本，不关联人员表（需求 5.2.5 第 2 条）';
COMMENT ON COLUMN dtl_demand_acceptance.accepted_at IS '线下验收的实际日期，可回填（需求 8.3.4 第 32 项）';
COMMENT ON COLUMN dtl_demand_acceptance.acceptance_result IS '验收结论。只有通过／不通过两个值加一段文字意见，不做价值量化（需求 5.2.5 第 5 条、N14）';

CREATE INDEX idx_demand_acceptance_demand ON dtl_demand_acceptance (demand_id) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- rel_demand_course　需求↔课程关联（开发 6.3.1，规则 R1、R4）
--
-- R1 明确禁止用外键字段表达这个关系。R4 要求双向可查，因此除主键顺序外还要建反向索引。
-- 本表刻意不加 deleted 列：解除关联就是物理删除该行，关联关系的变更由 audit_op_log 留痕。
-- -----------------------------------------------------------------------------
CREATE TABLE rel_demand_course
(
    id         BIGSERIAL PRIMARY KEY,
    demand_id  BIGINT      NOT NULL REFERENCES biz_demand (id),
    course_id  BIGINT      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL,

    CONSTRAINT uk_rel_demand_course UNIQUE (demand_id, course_id)
);

COMMENT ON TABLE rel_demand_course IS '需求↔课程 N:N 关联（规则 R1）。无 deleted 列，解除关联即物理删除，变更由 audit_op_log 留痕';
COMMENT ON COLUMN rel_demand_course.course_id IS '课程ID。外键约束在 V1_004 建 biz_course 后补，避免脚本间的建表顺序依赖';

-- 反向索引支持「从课程看解决了哪些需求」（R4）
CREATE INDEX idx_rel_dc_course ON rel_demand_course (course_id, demand_id);


-- -----------------------------------------------------------------------------
-- biz_value_report　业务价值人工填报（需求 7.8、15.6）
--
-- 一期业务价值全部来自人工填报，系统不做任何自动回收与校验（N14）。
--
-- 关联需求／关联案例用 JSONB 存 ID 数组，不建关联表：15.6 的三个指标只做 SUM(成本节约值)
-- 与 COUNT(填报行)，不遍历这两个关系；且没有任何物理删除依赖它们的完整性——这与附件引用
-- 必须建表（sys_attachment_ref）的判断标准是同一条。
-- -----------------------------------------------------------------------------
CREATE TABLE biz_value_report
(
    id             BIGSERIAL PRIMARY KEY,
    report_period  VARCHAR(16)  NOT NULL,
    efficiency_gain VARCHAR(500),
    quality_gain   VARCHAR(500),
    cost_saving    NUMERIC(14, 2),
    cost_saving_unit VARCHAR(16),
    demand_ids     JSONB,
    case_ids       JSONB,
    description    VARCHAR(2000),

    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(50)  NOT NULL,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by     VARCHAR(50),
    deleted        BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_value_report_unit CHECK (cost_saving_unit IS NULL OR cost_saving_unit IN ('万元', '人天'))
);

COMMENT ON TABLE biz_value_report IS '业务价值人工填报（需求 7.8）。一期只有人工填报，不做自动回收与上线效果比对（N14）';
COMMENT ON COLUMN biz_value_report.report_period IS '填报期间，年月格式如 2026-07。15.6 按「填报期间 ∈ 本年度」汇总';
COMMENT ON COLUMN biz_value_report.efficiency_gain IS '效率提升值，文本，如「审批环节由 3 天缩短至 0.5 天」。非空即计入「效率改善条目数」';
COMMENT ON COLUMN biz_value_report.cost_saving IS '成本节约值。15.6 第 1 项按单位分组汇总本年度累计值';
COMMENT ON COLUMN biz_value_report.demand_ids IS '关联需求ID数组。JSONB 而非关联表，理由见表头注释';

CREATE INDEX idx_value_report_period ON biz_value_report (report_period) WHERE deleted = FALSE;
