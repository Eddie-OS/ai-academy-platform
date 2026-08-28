-- 阶段 4：定时任务执行日志（开发 5.11.1）。

CREATE TABLE sys_job_run_log
(
    id          BIGSERIAL PRIMARY KEY,
    job_name    VARCHAR(100) NOT NULL,
    started_at  TIMESTAMPTZ  NOT NULL,
    finished_at TIMESTAMPTZ,
    success     BOOLEAN,
    message     VARCHAR(2000),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  VARCHAR(50)  NOT NULL DEFAULT 'system',
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by  VARCHAR(50),
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_job_run_log_name ON sys_job_run_log (job_name, started_at DESC);

COMMENT ON TABLE sys_job_run_log IS '定时任务每次执行写一条（开发 5.11.1）。当前假设单实例部署';
