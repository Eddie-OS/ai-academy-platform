-- 阶段 4：催办配置（需求 13.9.5，六项）。单行配置表，键固定为 id=1。

CREATE TABLE cfg_escalation
(
    id                    BIGINT PRIMARY KEY DEFAULT 1,
    cycle_weekday         INT          NOT NULL DEFAULT 1,  -- ISO：1=周一 … 7=周日
    cycle_time            TIME         NOT NULL DEFAULT TIME '09:00',
    list_enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    append_blue           BOOLEAN      NOT NULL DEFAULT TRUE,
    append_yellow         BOOLEAN      NOT NULL DEFAULT TRUE,
    append_red            BOOLEAN      NOT NULL DEFAULT TRUE,
    template_text         VARCHAR(2000) NOT NULL,
    min_interval_hours    INT          NOT NULL DEFAULT 24,
    pre_session_days      INT          NOT NULL DEFAULT 3,

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_escalation_cfg_singleton CHECK (id = 1),
    CONSTRAINT ck_escalation_cfg_weekday CHECK (cycle_weekday BETWEEN 1 AND 7),
    CONSTRAINT ck_escalation_cfg_interval CHECK (min_interval_hours BETWEEN 1 AND 168),
    CONSTRAINT ck_escalation_cfg_pre_days CHECK (pre_session_days BETWEEN 0 AND 30)
);

COMMENT ON TABLE cfg_escalation IS '催办配置（需求 13.9.5）。单行；滚动周期边界由 cycle_weekday+cycle_time 算出，不建每周一定时任务（开发 5.8.2）';
COMMENT ON COLUMN cfg_escalation.cycle_weekday IS '清单重算周期的星期（ISO 1=周一）。RM1 的「算」时间，不是「发」时间';
COMMENT ON COLUMN cfg_escalation.list_enabled IS '待催办清单是否启用全量周期视图；关闭后仅保留灯色变化追加（RM2）';
COMMENT ON COLUMN cfg_escalation.append_blue IS '蓝灯变化是否追加清单（RM2）';
COMMENT ON COLUMN cfg_escalation.append_yellow IS '黄灯变化是否追加清单（RM2）';
COMMENT ON COLUMN cfg_escalation.append_red IS '红灯变化是否追加清单（RM2）';
COMMENT ON COLUMN cfg_escalation.template_text IS '催办默认模板，占位符：{对象名称}{当前状态}{剩余天数}{负责人姓名}';
COMMENT ON COLUMN cfg_escalation.min_interval_hours IS '同一对象+负责人重复记台账的最小间隔小时（D1），初始 24';
COMMENT ON COLUMN cfg_escalation.pre_session_days IS '培训场次开课前提前进入清单的天数（13.5.5），初始 3';

INSERT INTO cfg_escalation (id, template_text, created_by)
VALUES (1,
        '【催办】{对象名称} 当前状态为「{当前状态}」，距预计完成尚余 {剩余天数} 天，请负责人 {负责人姓名} 尽快处理。',
        'system');
