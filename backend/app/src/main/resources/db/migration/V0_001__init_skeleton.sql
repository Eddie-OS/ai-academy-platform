-- =============================================================================
-- V0_001__init_skeleton.sql
--
-- 阶段 0 的初始脚本。命名遵循规则 DB-2：V{阶段}_{序号}__{描述}.sql
-- 规则 DB-3：本脚本一旦合并到主干即禁止修改，修正必须新增脚本。
--
-- 本脚本只做两件事：
--   1. 以注释形式固化《开发实施文档》6.1.2 的公共字段模板，供阶段 1 建 43 张表时复制；
--   2. 建一张示例表 sys_skeleton_sample，用来验证 Flyway、MyBatis、逻辑删除与乐观锁跑通。
--
-- 不建任何业务表。阶段 1 开始后 sys_skeleton_sample 由 V1_00x 脚本 DROP。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 公共字段模板（6.1.2）—— 每张业务表必须包含，一个字段都不能省
-- -----------------------------------------------------------------------------
--   id              BIGSERIAL PRIMARY KEY,
--   created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   created_by      VARCHAR(50) NOT NULL,                  -- 共享账号号，固定两值之一
--   updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- 需求 C6「最后编辑时间」
--   updated_by      VARCHAR(50),
--   deleted         BOOLEAN     NOT NULL DEFAULT FALSE     -- 规则 SEC2 一律逻辑删除
--
-- 五类带状态的主对象额外包含：
--   last_state_changed_at TIMESTAMPTZ,            -- 需求 C5，红灯停滞判定的唯一依据
--   version               INT NOT NULL DEFAULT 0  -- 规则 K1，仅需求/课程/案例三张表
--
-- 三条硬约束：
--   1. updated_at 与 last_state_changed_at 必须是两个独立字段。改一个错别字只更新
--      updated_at，红灯不会消失。一旦合并成一个字段，停滞预警与 9 个效率指标整体失效。
--   2. 时间统一 TIMESTAMPTZ；纯日期语义的字段（预计完成时间、计划结束日期、授课日期）用 DATE，
--      否则「剩余天数」会因时分秒不同出现 ±1 天偏差（6.1.4）。
--   3. 枚举用中文字符串 VARCHAR(64) + CHECK，不用数字码、不用 PostgreSQL ENUM 类型（6.1.3）。
-- -----------------------------------------------------------------------------


-- pg_trgm：一期不引搜索引擎（16.1.5），需求/课程/案例的名称模糊搜索靠 GIN + pg_trgm 走索引。
-- 在阶段 0 建好扩展，避免阶段 2 建索引时才发现没有权限装扩展。
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- -----------------------------------------------------------------------------
-- 示例表：sys_skeleton_sample
-- 它是公共字段模板的可执行版本，不承载任何业务语义。
-- -----------------------------------------------------------------------------
CREATE TABLE sys_skeleton_sample
(
    id                    BIGSERIAL PRIMARY KEY,
    sample_no             VARCHAR(64)  NOT NULL,
    sample_name           VARCHAR(200) NOT NULL,
    sample_state          VARCHAR(64)  NOT NULL,
    owner_no              VARCHAR(50),
    expect_finish_date    DATE,

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    last_state_changed_at TIMESTAMPTZ,
    version               INT          NOT NULL DEFAULT 0,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_skeleton_sample_no UNIQUE (sample_no)
);

COMMENT ON TABLE sys_skeleton_sample IS '阶段 0 骨架示例表，阶段 1 删除';
COMMENT ON COLUMN sys_skeleton_sample.owner_no IS '负责人工号。保留字段但不参与判权（需求 V1.2 术语表）';
COMMENT ON COLUMN sys_skeleton_sample.updated_at IS '最后编辑时间（需求 C6）';
COMMENT ON COLUMN sys_skeleton_sample.last_state_changed_at IS '最后状态变更时间（需求 C5），红灯判定唯一依据';

-- 部分索引：全库查询都带 deleted = false，只索引未删除行（选 PostgreSQL 的理由之三）
CREATE INDEX idx_skeleton_sample_state
    ON sys_skeleton_sample (sample_state)
    WHERE deleted = FALSE;

CREATE INDEX idx_skeleton_sample_light
    ON sys_skeleton_sample (expect_finish_date, last_state_changed_at)
    WHERE deleted = FALSE;
