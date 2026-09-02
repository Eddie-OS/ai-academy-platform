-- =============================================================================
-- V5_025__lecturer_cert_and_level.sql
--
-- 讲师详情「认证记录」「等级变更记录」：只记录运营录入的结果。
-- 不建认证引擎、不做等级评估模型，也不自动改档案上的等级或培养状态。
-- =============================================================================

CREATE TABLE dtl_lecturer_certification (
    id BIGSERIAL PRIMARY KEY,
    lecturer_id BIGINT NOT NULL REFERENCES biz_lecturer (id),
    cert_batch VARCHAR(64),
    lecturer_level VARCHAR(8),
    cert_state VARCHAR(64) NOT NULL,
    reviewers TEXT,
    opinion TEXT,
    passed_on DATE,
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50),
    deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_lecturer_cert_lecturer
    ON dtl_lecturer_certification (lecturer_id)
    WHERE deleted = FALSE;

COMMENT ON TABLE dtl_lecturer_certification IS '讲师认证记录。只记录结果，没有认证审批';
COMMENT ON COLUMN dtl_lecturer_certification.cert_batch IS '认证批次，如 2026-08 批次';
COMMENT ON COLUMN dtl_lecturer_certification.lecturer_level IS '本条认证对应的等级 L0–L4';
COMMENT ON COLUMN dtl_lecturer_certification.cert_state IS '本条认证状态：待认证／认证中／已认证';
COMMENT ON COLUMN dtl_lecturer_certification.reviewers IS '认证评审人员';
COMMENT ON COLUMN dtl_lecturer_certification.opinion IS '认证意见：评审反馈、整改要求';
COMMENT ON COLUMN dtl_lecturer_certification.passed_on IS '认证通过时间，正式生效日';
COMMENT ON COLUMN dtl_lecturer_certification.valid_from IS '认证有效期起';
COMMENT ON COLUMN dtl_lecturer_certification.valid_to IS '认证有效期止';

CREATE TABLE dtl_lecturer_level_log (
    id BIGSERIAL PRIMARY KEY,
    lecturer_id BIGINT NOT NULL REFERENCES biz_lecturer (id),
    change_no VARCHAR(32) NOT NULL,
    trigger_reason VARCHAR(200),
    change_desc TEXT,
    changed_on DATE,
    level_after VARCHAR(8) NOT NULL,
    reviewer VARCHAR(200),
    review_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (change_no)
);

CREATE INDEX idx_lecturer_level_log_lecturer
    ON dtl_lecturer_level_log (lecturer_id)
    WHERE deleted = FALSE;

COMMENT ON TABLE dtl_lecturer_level_log IS '讲师等级变更记录。只记录结果，不是评估模型';
COMMENT ON COLUMN dtl_lecturer_level_log.change_no IS '变更记录编号，系统按 BG + 流水生成';
COMMENT ON COLUMN dtl_lecturer_level_log.trigger_reason IS '变更触发原因，自由文本';
COMMENT ON COLUMN dtl_lecturer_level_log.change_desc IS '等级变更说明，如从 L1 变更为 L2';
COMMENT ON COLUMN dtl_lecturer_level_log.changed_on IS '等级变更时间';
COMMENT ON COLUMN dtl_lecturer_level_log.level_after IS '变更后等级 L0–L4';
COMMENT ON COLUMN dtl_lecturer_level_log.reviewer IS '评审人';
COMMENT ON COLUMN dtl_lecturer_level_log.review_comment IS '评审意见';
