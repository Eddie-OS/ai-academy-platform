-- =============================================================================
-- V5_024__lecturer_cultivation.sql
--
-- 讲师详情「培养计划与培养记录」：只记录运营录入的结果，不是培养引擎、没有审批。
-- 培养计划上的状态（待培养／培养中／已完成培养）与档案培养状态（待培养／培养中／可上岗）分开，
-- 后者仍只服务排课校验一，本表改值不写状态流转日志（TS2）。
-- =============================================================================

CREATE TABLE dtl_lecturer_cultivation (
    id BIGSERIAL PRIMARY KEY,
    lecturer_id BIGINT NOT NULL REFERENCES biz_lecturer (id),
    plan_text TEXT,
    planned_from DATE,
    planned_to DATE,
    cultivation_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    record_text TEXT,
    actual_from DATE,
    actual_to DATE,
    plan_state VARCHAR(64) NOT NULL,
    evaluation TEXT,
    remark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50),
    deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_lecturer_cultivation_lecturer
    ON dtl_lecturer_cultivation (lecturer_id)
    WHERE deleted = FALSE;

COMMENT ON TABLE dtl_lecturer_cultivation IS '讲师培养计划与培养记录。只记录结果，不做培养引擎';
COMMENT ON COLUMN dtl_lecturer_cultivation.plan_text IS '培养计划正文；附件另挂 sys_attachment_ref';
COMMENT ON COLUMN dtl_lecturer_cultivation.planned_from IS '计划培养周期起，纯日期';
COMMENT ON COLUMN dtl_lecturer_cultivation.planned_to IS '计划培养周期止，纯日期';
COMMENT ON COLUMN dtl_lecturer_cultivation.cultivation_types IS '培养类型多选，JSONB 字符串数组';
COMMENT ON COLUMN dtl_lecturer_cultivation.record_text IS '培养记录：观摩、模拟试讲、辅导等';
COMMENT ON COLUMN dtl_lecturer_cultivation.actual_from IS '实际培养周期起';
COMMENT ON COLUMN dtl_lecturer_cultivation.actual_to IS '实际培养周期止';
COMMENT ON COLUMN dtl_lecturer_cultivation.plan_state IS '本条计划状态：待培养／培养中／已完成培养';
COMMENT ON COLUMN dtl_lecturer_cultivation.evaluation IS '培养评价';
COMMENT ON COLUMN dtl_lecturer_cultivation.remark IS '备注';
