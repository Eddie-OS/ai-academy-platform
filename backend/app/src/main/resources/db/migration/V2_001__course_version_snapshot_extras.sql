-- =============================================================================
-- V2_001__course_version_snapshot_extras.sql
--
-- 阶段 2 A-3：材料版本快照（规则 R7）落地时补齐两处 schema 缺口。
--
-- 两处都是阶段 1 建表时按开发实施文档 6.2.3 的表清单录的，而这两项写在需求文档里、
-- 6.2.3 的清单没列到。按 DB-3「已合并的脚本禁止修改」，用新脚本补而不是改 V1_004。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 缺口一：版本的快照触发方式（需求 9.5.2 第 5 项）
--
-- 需求 9.5.1 给了两种触发：提交评审时系统自动快照、运营手动创建快照；9.5.3 要求版本历史
-- 列表展示这一列。缺了它，两种来源的版本在界面上无法区分——而这正是运营判断「这个版本
-- 是不是评审当时那份」的依据。
--
-- 默认值给「手动创建」而不是「提交评审自动」：本列上线时库里还没有任何版本行（材料版本
-- 功能就是本批实现的），默认值只是为了让 NOT NULL 成立，不会影响任何既有数据。
-- -----------------------------------------------------------------------------
ALTER TABLE dtl_course_material_version
    ADD COLUMN trigger_type VARCHAR(16) NOT NULL DEFAULT '手动创建';

ALTER TABLE dtl_course_material_version
    ADD CONSTRAINT ck_material_version_trigger
        CHECK (trigger_type IN ('提交评审自动', '手动创建'));

COMMENT ON COLUMN dtl_course_material_version.trigger_type IS '快照触发方式（需求 9.5.2）。版本历史列表按它区分自动快照与手动快照';


-- -----------------------------------------------------------------------------
-- 缺口二：自检结果随材料一起快照（需求 9.4.3 规则 CK4）
--
-- CK4：「提交评审自动快照材料版本时，自检结果一并快照，否则评审后修改自检会导致评审意见
-- 与自检内容错位」。dtl_course_selfcheck 上有 UNIQUE (course_id, item_id)，一门课程一题
-- 只有一行当前值，没有地方放历史——所以快照必须是独立的表。
--
-- 与 dtl_course_selfcheck 一样存题目原文快照：题库改过之后，历史版本里的自检结果不能漂移
-- 到新题面上（开发 6.3.9 对 item_text_snapshot 的说明同样适用）。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_selfcheck_snapshot
(
    id                 BIGSERIAL PRIMARY KEY,
    version_id         BIGINT       NOT NULL REFERENCES dtl_course_material_version (id),
    item_id            BIGINT       NOT NULL,
    item_text_snapshot VARCHAR(300) NOT NULL,
    checked            BOOLEAN      NOT NULL,
    note               VARCHAR(500),
    seq_no             INT          NOT NULL DEFAULT 0,

    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(50)  NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by         VARCHAR(50),
    deleted            BOOLEAN      NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE dtl_selfcheck_snapshot IS '自检结果快照（需求 9.4.3 规则 CK4）。随材料版本一起产生，评审记录据此看到当时的自检内容';
COMMENT ON COLUMN dtl_selfcheck_snapshot.item_id IS '题库 ID，仅供追溯。不建外键：题目被删除后快照仍要完整可读';
COMMENT ON COLUMN dtl_selfcheck_snapshot.item_text_snapshot IS '快照当时的题目原文。题库改动后历史快照不得漂移';

CREATE INDEX idx_selfcheck_snapshot_version ON dtl_selfcheck_snapshot (version_id, seq_no) WHERE deleted = FALSE;
