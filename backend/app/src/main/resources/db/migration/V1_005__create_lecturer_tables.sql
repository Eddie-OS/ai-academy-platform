-- =============================================================================
-- V1_005__create_lecturer_tables.sql
--
-- 阶段 1B：讲师模块 3 张表（开发实施文档 6.2.4）。
--
-- 本模块有一条贯穿性的建模决策，写在这里避免三张表各说一遍：
--
--   「首次到达」类事实随状态转换落库，纯聚合类指标实时算。
--
-- 需求 10.3 把第 11–13 项（累计授课次数、累计学员人次、平均评分）标为「A 系统自动生成」，
-- 但 15.3 同时给了它们的计算公式。落库就要维护刷新逻辑，且 C14 已明确「数据量小，实时算
-- 即可，缓存反而让运营改完数据看到旧值」，因此这三项**不建列**，与灯色、停滞天数同样处理。
-- 而第 9、10 项（试讲合格标记、首次试讲合格时间）建列——它们是「首次到达」型事实，由试讲
-- 结论录入这一次转换写入，与 biz_demand.first_online_date、biz_course.first_publish_date
-- 是同一类字段。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- biz_lecturer　讲师主表（需求 10.3）
--
-- 讲师培养状态不是状态机（C10 确认为自由选择的枚举字段，需求 5.13 明确「讲师培养状态不在
-- 此列」），因此本表没有 last_state_changed_at，也不参与三色灯。
--
-- 一期明确不设的字段（N6）不要建：讲师层级 L1–L4、认证粒度与有效期、可授课程列表、授课范围
-- 与组织范围、可排期时间、负载上限、能力标签与熟练度、低评分预警标记。
-- -----------------------------------------------------------------------------
CREATE TABLE biz_lecturer
(
    id                   BIGSERIAL PRIMARY KEY,
    lecturer_no          VARCHAR(64)  NOT NULL,
    lecturer_name        VARCHAR(50)  NOT NULL,
    employee_no          VARCHAR(50)  NOT NULL,
    source_dept          VARCHAR(50)  NOT NULL,
    expertise_domains    JSONB        NOT NULL,
    teaching_direction   VARCHAR(500) NOT NULL,
    join_type            VARCHAR(32)  NOT NULL,
    joined_date          DATE         NOT NULL,
    training_state       VARCHAR(16)  NOT NULL,
    trial_qualified      BOOLEAN      NOT NULL DEFAULT FALSE,
    first_qualified_date DATE,
    pool_state           VARCHAR(16)  NOT NULL,
    removed_reason       VARCHAR(500),
    import_batch_no      VARCHAR(64),

    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by           VARCHAR(50)  NOT NULL,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by           VARCHAR(50),
    deleted              BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_lecturer_no UNIQUE (lecturer_no),
    CONSTRAINT uk_lecturer_employee_no UNIQUE (employee_no),
    CONSTRAINT ck_lecturer_join_type CHECK (join_type IN ('课程开发人员自动入池', '运营手动添加', '批量导入')),
    CONSTRAINT ck_lecturer_training_state CHECK (training_state IN ('待培养', '培养中', '可上岗')),
    CONSTRAINT ck_lecturer_pool_state CHECK (pool_state IN ('在池', '已移出'))
);

COMMENT ON TABLE biz_lecturer IS '讲师主表（需求第 10 章）';
COMMENT ON COLUMN biz_lecturer.lecturer_no IS '讲师ID，规则：JS + 4 位流水';
COMMENT ON COLUMN biz_lecturer.employee_no IS '工号，唯一，与人员台账 org_employee 关联';
COMMENT ON COLUMN biz_lecturer.source_dept IS '来源部门。V1.2 由「部门选择」改为自由文本（N18），仅用于展示与筛选';
COMMENT ON COLUMN biz_lecturer.expertise_domains IS '擅长领域，多选枚举值数组，取自作战单元字典';
COMMENT ON COLUMN biz_lecturer.training_state IS '讲师培养状态（C10）。自由选择不受顺序约束，不是状态机（需求 5.13）。培训场次的授课讲师只能选「可上岗」者（排课校验一，需求 11.4.1）';
COMMENT ON COLUMN biz_lecturer.trial_qualified IS '试讲合格标记。存在任一条讲师结论=合格的试讲记录即为真。与培养状态相互独立';
COMMENT ON COLUMN biz_lecturer.first_qualified_date IS '首次试讲合格时间。「首次到达」型事实，随试讲结论录入写入一次，后续不改';
COMMENT ON COLUMN biz_lecturer.pool_state IS '在池状态。移出为逻辑删除。V1.2 由「讲师状态」改名，避免与培养状态混淆';

CREATE INDEX idx_lecturer_pool_state ON biz_lecturer (pool_state) WHERE deleted = FALSE;
CREATE INDEX idx_lecturer_training_state ON biz_lecturer (training_state) WHERE deleted = FALSE;
CREATE INDEX idx_lecturer_employee ON biz_lecturer (employee_no) WHERE deleted = FALSE;
CREATE INDEX idx_lecturer_batch ON biz_lecturer (import_batch_no) WHERE deleted = FALSE;
CREATE INDEX idx_lecturer_name_trgm ON biz_lecturer USING GIN (lecturer_name gin_trgm_ops);

-- dtl_course_trial.lecturer_id 的外键在此补齐（V1_004 建表时 biz_lecturer 尚不存在）
ALTER TABLE dtl_course_trial
    ADD CONSTRAINT fk_course_trial_lecturer FOREIGN KEY (lecturer_id) REFERENCES biz_lecturer (id);


-- -----------------------------------------------------------------------------
-- dtl_teaching_record　授课记录（需求 15.3）
--
-- 15.3 的四个指标直接读这张表：累计授课次数 COUNT、累计学员人次 SUM(实际参训人数)、
-- 本月授课人次、活跃讲师数 DISTINCT(讲师ID) WHERE 授课日期 ≥ 当前日期 − 90 天。
--
-- **需求文档没有给这张表的字段清单，字段由 15.3 的公式反推。** 已记入待修文档清单。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_teaching_record
(
    id                    BIGSERIAL PRIMARY KEY,
    lecturer_id           BIGINT      NOT NULL REFERENCES biz_lecturer (id),
    session_id            BIGINT      NOT NULL,
    course_id             BIGINT      REFERENCES biz_course (id),
    teaching_date         DATE        NOT NULL,
    actual_attendee_count INT         NOT NULL DEFAULT 0,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50) NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    deleted               BOOLEAN     NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE dtl_teaching_record IS '授课记录（需求 15.3）。讲师类指标 1、2、5、7 的数据源';
COMMENT ON COLUMN dtl_teaching_record.session_id IS '培训场次ID。外键在 V1_006 建 biz_training_session 后补';
COMMENT ON COLUMN dtl_teaching_record.actual_attendee_count IS '实际参训人数，「讲师累计学员人次」的被加项（需求 15.3 第 2 项）';

CREATE INDEX idx_teaching_record_lecturer ON dtl_teaching_record (lecturer_id, teaching_date) WHERE deleted = FALSE;
CREATE INDEX idx_teaching_record_session ON dtl_teaching_record (session_id) WHERE deleted = FALSE;
CREATE INDEX idx_teaching_record_date ON dtl_teaching_record (teaching_date) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_student_evaluation　学员评价与评分（开发 6.2.4）
--
-- ⚠ 本表在一期没有任何写入方与读取方，建表只为与开发 6.2.4 的表清单对齐。
--
-- 理由：6.2.4 说它的数据来源是「学员反馈导入」，而学员反馈导入的落库表是
-- dtl_training_feedback（需求 11.7.2 给了它完整的字段清单）。需求 15.3 的讲师类指标
-- 第 3、4、6 项一律写作 `AVG(学员反馈.评分 ...)`，**没有任何指标读「学员评价」**。
-- 也就是说这张表与 dtl_training_feedback 是同一份导入数据的两个落点。
--
-- 因此定下两条纪律，防止阶段 3 实现指标时出错：
--   1. 讲师平均评分只读 dtl_training_feedback，不读本表；
--   2. 学员反馈导入 Handler 只写 dtl_training_feedback，不写本表。
-- 否则会出现「两张表都写 → 全局平均评分重复计数」，这正是 15.3 结尾警告的那类错误
-- （试讲反馈 1 分与正式反馈 5 分不得平均成 3.0）。
--
-- 是否保留本表已列入待修文档清单，等待裁决。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_student_evaluation
(
    id             BIGSERIAL PRIMARY KEY,
    lecturer_id    BIGINT      NOT NULL REFERENCES biz_lecturer (id),
    session_id     BIGINT      NOT NULL,
    submitter_no   VARCHAR(50),
    score          INT         NOT NULL,
    content        VARCHAR(5000),

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(50) NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by     VARCHAR(50),
    deleted        BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_student_evaluation_score CHECK (score BETWEEN 1 AND 5)
);

COMMENT ON TABLE dtl_student_evaluation IS '学员评价与评分（开发 6.2.4）。⚠ 一期无写入方无读取方——讲师平均评分读 dtl_training_feedback，见本表在迁移脚本中的说明';
COMMENT ON COLUMN dtl_student_evaluation.submitter_no IS '提交人工号。匿名时为 NULL（同 dtl_training_feedback 的策略）';

CREATE INDEX idx_student_evaluation_lecturer ON dtl_student_evaluation (lecturer_id) WHERE deleted = FALSE;
