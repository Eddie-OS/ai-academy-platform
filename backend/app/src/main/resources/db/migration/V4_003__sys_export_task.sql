-- 阶段 4：异步导出任务元数据（开发 5.11.2）。文件存 export 目录，与附件分离。

CREATE TABLE sys_export_task
(
    id            BIGSERIAL PRIMARY KEY,
    resource_type VARCHAR(64)  NOT NULL,
    status        VARCHAR(32)  NOT NULL,
    file_name     VARCHAR(255),
    storage_path  VARCHAR(500),
    row_count     BIGINT,
    query_json    TEXT,
    error_message VARCHAR(1000),
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(50)  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by    VARCHAR(50),
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_export_status CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED'))
);

CREATE INDEX idx_export_task_status ON sys_export_task (status, created_at DESC) WHERE deleted = FALSE;

COMMENT ON TABLE sys_export_task IS '异步导出任务（开发 5.11.2）。≤2000 行同步不落本表；>2000 行写本表并由前端轮询';
