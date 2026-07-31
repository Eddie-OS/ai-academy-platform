-- =============================================================================
-- V1_006__create_training_tables.sql
--
-- 阶段 1B：培训模块 7 张表（开发实施文档 6.2.5）。
--
-- 沿用 V1_005 的那条建模决策：纯聚合类字段不落库。本模块有两个：
--   biz_training_plan.实际场次数    = 下属场次记录数，COUNT 得出
--   biz_training_session.实际签到人数 = 签到状态为「已签到」的记录数，COUNT 得出
-- 而「时长（小时）」要建列，因为需求 11.4 第 8 项注明「由起止时间计算，可手工覆盖」——
-- 能被手工覆盖的值就不再是纯派生值。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- biz_training_plan　培训计划（需求 11.3，规则 R8）
--
-- 培训排期拆为「培训计划 → 培训场次」两级（需求 3.1 第 3 项），V1 中两者混为一体。
-- -----------------------------------------------------------------------------
CREATE TABLE biz_training_plan
(
    id                    BIGSERIAL PRIMARY KEY,
    plan_no               VARCHAR(64)  NOT NULL,
    plan_name             VARCHAR(100) NOT NULL,
    course_id             BIGINT       NOT NULL REFERENCES biz_course (id),
    owner_no              VARCHAR(50)  NOT NULL,
    deputy_id             BIGINT,
    target_scope          VARCHAR(500) NOT NULL,
    plan_start_date       DATE         NOT NULL,
    plan_end_date         DATE         NOT NULL,
    plan_session_count    INT,
    plan_state            VARCHAR(64)  NOT NULL,
    actual_finish_date    DATE,
    remark                VARCHAR(1000),

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    last_state_changed_at TIMESTAMPTZ,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_training_plan_no UNIQUE (plan_no),
    CONSTRAINT ck_training_plan_state CHECK (plan_state IN ('待执行', '执行中', '已完成'))
);

COMMENT ON TABLE biz_training_plan IS '培训计划（需求第 11 章，规则 R8）';
COMMENT ON COLUMN biz_training_plan.plan_no IS '计划ID，规则：JH + 年月 + 3 位流水';
COMMENT ON COLUMN biz_training_plan.course_id IS '关联课程。V1.2 起排课三项校验移到场次创建时执行（需求 11.4），计划这一层不校验';
COMMENT ON COLUMN biz_training_plan.deputy_id IS '代理人。V1.2 删除代理机制（N19），保留此列但不写入';
COMMENT ON COLUMN biz_training_plan.plan_end_date IS '计划结束日期。三色灯蓝灯与黄灯的判定基准（IX-3）';
COMMENT ON COLUMN biz_training_plan.plan_session_count IS '计划场次数。计划值，与实际场次数可不一致（需求 11.3 第 9 项）';
COMMENT ON COLUMN biz_training_plan.actual_finish_date IS '实际完成时间。计划状态首次变为「已完成」时写入，是培训计划按时完成率的判定依据（需求 15.2.1 第 9 项）';

CREATE INDEX idx_training_plan_state ON biz_training_plan (plan_state) WHERE deleted = FALSE;
CREATE INDEX idx_training_plan_light ON biz_training_plan (plan_end_date, last_state_changed_at) WHERE deleted = FALSE;
CREATE INDEX idx_training_plan_owner ON biz_training_plan (owner_no) WHERE deleted = FALSE;
CREATE INDEX idx_training_plan_course ON biz_training_plan (course_id) WHERE deleted = FALSE;
CREATE INDEX idx_training_plan_name_trgm ON biz_training_plan USING GIN (plan_name gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- biz_training_session　培训场次（需求 11.4，规则 R8）
--
-- 排课三项校验（需求 11.4.1）在场次创建时执行，是 C9 允许的三处业务前置校验之一。
-- 校验逻辑属阶段 3，本表只提供它依赖的列。
--
-- 开始时间／结束时间用 TIME：它们是一天内的时刻，不带日期也不带时区，日期在 training_date。
-- -----------------------------------------------------------------------------
CREATE TABLE biz_training_session
(
    id                    BIGSERIAL PRIMARY KEY,
    session_no            VARCHAR(64)  NOT NULL,
    plan_id               BIGINT       NOT NULL REFERENCES biz_training_plan (id),
    session_name          VARCHAR(100),
    course_id             BIGINT       REFERENCES biz_course (id),
    lecturer_id           BIGINT       NOT NULL REFERENCES biz_lecturer (id),
    training_date         DATE         NOT NULL,
    start_time            TIME         NOT NULL,
    end_time              TIME         NOT NULL,
    duration_hours        NUMERIC(5, 1),
    training_form         VARCHAR(16)  NOT NULL,
    venue                 VARCHAR(200),
    online_link           VARCHAR(500),
    student_scope         VARCHAR(500) NOT NULL,
    plan_attendee_count   INT,
    session_state         VARCHAR(64)  NOT NULL,
    remark                VARCHAR(1000),

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(50)  NOT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by            VARCHAR(50),
    last_state_changed_at TIMESTAMPTZ,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_training_session_no UNIQUE (session_no),
    CONSTRAINT ck_training_form CHECK (training_form IN ('线下', '线上', '混合')),
    CONSTRAINT ck_training_session_state CHECK (session_state IN ('待开课', '已开课', '已结束', '已归档'))
);

COMMENT ON TABLE biz_training_session IS '培训场次（需求 11.4，规则 R8）。挂在计划下';
COMMENT ON COLUMN biz_training_session.session_no IS '场次ID，规则：计划ID + "-" + 2 位场次序号，如 JH2026070001-01。签到导入模板以此为关联键（需求 14.4）';
COMMENT ON COLUMN biz_training_session.session_name IS '场次名称。留空时自动生成「计划名称 第N场」';
COMMENT ON COLUMN biz_training_session.course_id IS '关联课程。随计划带出，允许运营修改为其他课程';
COMMENT ON COLUMN biz_training_session.lecturer_id IS '授课讲师。仅可选培养状态=可上岗者，这是排课校验一（需求 11.4.1）';
COMMENT ON COLUMN biz_training_session.duration_hours IS '时长（小时），支持 0.5 步进。由起止时间计算但可手工覆盖，故落库';
COMMENT ON COLUMN biz_training_session.plan_attendee_count IS '计划人数。一期不做人数上限校验（需求议题 23、24）';

CREATE INDEX idx_training_session_plan ON biz_training_session (plan_id) WHERE deleted = FALSE;
CREATE INDEX idx_training_session_state ON biz_training_session (session_state) WHERE deleted = FALSE;
CREATE INDEX idx_training_session_date ON biz_training_session (training_date) WHERE deleted = FALSE;
CREATE INDEX idx_training_session_lecturer ON biz_training_session (lecturer_id, training_date) WHERE deleted = FALSE;
CREATE INDEX idx_training_session_course ON biz_training_session (course_id) WHERE deleted = FALSE;

-- dtl_teaching_record.session_id 的外键在此补齐（V1_005 建表时 biz_training_session 尚不存在）
ALTER TABLE dtl_teaching_record
    ADD CONSTRAINT fk_teaching_record_session FOREIGN KEY (session_id) REFERENCES biz_training_session (id);

ALTER TABLE dtl_student_evaluation
    ADD CONSTRAINT fk_student_evaluation_session FOREIGN KEY (session_id) REFERENCES biz_training_session (id);


-- -----------------------------------------------------------------------------
-- dtl_session_attendee　参训名单（需求 14.6）
--
-- 姓名快照的理由与签到记录相同（开发 6.3.6）：一年后查历史培训记录，应该看到「当时参训的
-- 是谁」，而人员表里的姓名理论上可能被修正。
--
-- **需求 14.6 是导入模板章节，本表的库侧字段清单属推导。** 已记入待修文档清单。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_session_attendee
(
    id                     BIGSERIAL PRIMARY KEY,
    session_id             BIGINT      NOT NULL REFERENCES biz_training_session (id),
    employee_no            VARCHAR(50) NOT NULL,
    employee_name_snapshot VARCHAR(50) NOT NULL,
    import_batch_no        VARCHAR(64),

    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by             VARCHAR(50) NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by             VARCHAR(50),
    deleted                BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_session_attendee UNIQUE (session_id, employee_no)
);

COMMENT ON TABLE dtl_session_attendee IS '参训名单（需求 14.6）。唯一录入方式是导入';
COMMENT ON COLUMN dtl_session_attendee.employee_name_snapshot IS '参训时的姓名快照，不 JOIN 人员表取当前值（开发 6.3.6 同理）';

CREATE INDEX idx_session_attendee_employee ON dtl_session_attendee (employee_no) WHERE deleted = FALSE;
CREATE INDEX idx_session_attendee_batch ON dtl_session_attendee (import_batch_no) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_attendance　签到记录（需求 14.4，开发 6.3.6）
--
-- 唯一约束 (session_id, employee_no) 必须建，它决定了签到导入的重复行处理方式：同一场次
-- 同一工号重复出现时按更新处理，而非插入两条。覆盖率指标取消后，签到数据的主要用途变成
-- 「场次实际参训人数」，重复行会直接让这个数字偏大（开发 6.3.6）。
--
-- V1.1 已删除 dept_code_snapshot 与它的索引（IX-5）：组织架构整体不做（N18），部门维度的
-- 覆盖率指标随之取消，这个字段失去全部用途。不要因为「快照更规范」把它加回来。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_attendance
(
    id                     BIGSERIAL PRIMARY KEY,
    session_id             BIGINT      NOT NULL REFERENCES biz_training_session (id),
    employee_no            VARCHAR(50) NOT NULL,
    employee_name_snapshot VARCHAR(64) NOT NULL,
    attend_status          VARCHAR(16) NOT NULL,
    import_batch_no        VARCHAR(64),

    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by             VARCHAR(50) NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by             VARCHAR(50),
    deleted                BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_attendance UNIQUE (session_id, employee_no),
    CONSTRAINT ck_attendance_status CHECK (attend_status IN ('已签到', '未签到'))
);

COMMENT ON TABLE dtl_attendance IS '签到记录（需求 14.4）。一期使用频率最高的导入功能';
COMMENT ON COLUMN dtl_attendance.employee_name_snapshot IS '签到时的姓名快照（开发 6.3.6）';
COMMENT ON COLUMN dtl_attendance.attend_status IS '签到状态，仅两值。不区分迟到、早退、请假、缺席（需求议题 24）';
COMMENT ON COLUMN dtl_attendance.import_batch_no IS '导入批次号，支持按批次撤销（需求 13.8.5）';

-- IX-5：唯一索引由上面的唯一约束提供，这里补 (employee_no) 普通索引
CREATE INDEX idx_attendance_employee ON dtl_attendance (employee_no) WHERE deleted = FALSE;
CREATE INDEX idx_attendance_batch ON dtl_attendance (import_batch_no) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_training_archive　培训归档材料（开发 6.2.5）
--
-- **需求文档没有给这张表的字段清单**（第 11 章只说培训归档是场次状态机的一个环节）。
-- 字段按「归档材料 = 若干附件 + 说明」推导。已记入待修文档清单。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_training_archive
(
    id            BIGSERIAL PRIMARY KEY,
    session_id    BIGINT       NOT NULL REFERENCES biz_training_session (id),
    material_name VARCHAR(200) NOT NULL,
    attachment_id BIGINT       REFERENCES sys_attachment (id),
    remark        VARCHAR(500),

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(50)  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by    VARCHAR(50),
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE dtl_training_archive IS '培训归档材料（开发 6.2.5）。场次状态转「已归档」时的留档';

CREATE INDEX idx_training_archive_session ON dtl_training_archive (session_id) WHERE deleted = FALSE;
CREATE INDEX idx_training_archive_attachment ON dtl_training_archive (attachment_id) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_training_feedback　学员反馈与心得（需求 11.7.2，C12）
--
-- V1.2 整节改写：原设计是「学员本人在系统内实名提交心得 → 运营答复 → 评选优秀 → 发放
-- 激励」，D35 改为问卷线下收集、运营导入、支持匿名，D32 把激励推二期。因此**提交入口、
-- 实名要求、评选与激励全部取消**（需求 11.7 表头说明、N20）。
--
-- 这张表是讲师平均评分的唯一数据源（需求 15.3 第 3、4、6 项）。试讲反馈
-- （dtl_trial_feedback）不计入（规则 R10）。
--
-- 匿名同 dtl_trial_feedback：submitter_no 写入 NULL。出口准则 E1-7 直接查库验证。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_training_feedback
(
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT       NOT NULL REFERENCES biz_training_session (id),
    submitter_no    VARCHAR(50),
    submitter_name  VARCHAR(50),
    submitter_dept  VARCHAR(50),
    score           INT          NOT NULL,
    content         VARCHAR(5000),
    feedback_scene  VARCHAR(16)  NOT NULL DEFAULT '正式授课',
    import_batch_no VARCHAR(64)  NOT NULL,
    imported_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ops_remark      VARCHAR(2000),
    remarked_at     TIMESTAMPTZ,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(50)  NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by      VARCHAR(50),
    deleted         BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_training_feedback_score CHECK (score BETWEEN 1 AND 5),
    CONSTRAINT ck_training_feedback_scene CHECK (feedback_scene IN ('正式授课'))
);

COMMENT ON TABLE dtl_training_feedback IS '学员反馈与心得（需求 11.7.2）。讲师平均评分的唯一数据源；唯一录入方式是运营导入';
COMMENT ON COLUMN dtl_training_feedback.submitter_no IS '提交人工号。留空即匿名，写入时直接存 NULL（开发 5.6.3 细节七、出口准则 E1-7）';
COMMENT ON COLUMN dtl_training_feedback.content IS '反馈内容。任何账号不可修改，录错只能撤销整批重导（需求 6.2.4 第 12 项）';
COMMENT ON COLUMN dtl_training_feedback.feedback_scene IS '反馈场景，固定为「正式授课」。与试讲反馈的区别见规则 R9、R10';
COMMENT ON COLUMN dtl_training_feedback.imported_at IS '导入时间，同时作为「提交时间」展示（需求 11.7.2 第 9 项）';
COMMENT ON COLUMN dtl_training_feedback.ops_remark IS '运营备注。原「运营答复」改名——匿名后没有具体的人可以答复，这是给自己团队看的记录（需求 11.7.2 第 10 项）';

CREATE INDEX idx_training_feedback_session ON dtl_training_feedback (session_id) WHERE deleted = FALSE;
CREATE INDEX idx_training_feedback_batch ON dtl_training_feedback (import_batch_no) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- dtl_feedback_incentive　激励发放记录（开发 6.2.5）
--
-- ⚠ 一期完全不使用这张表。建它只为与开发 6.2.5 的表清单对齐（该清单的 7 张之一是 V1.1 的
-- 遗留），并让二期启用激励时不必再动 DDL。
--
-- 需求侧已四处明确激励推二期：V1.2 削减清单第 4 项、N20、附录 A 第 13 项，以及验收点 A2-9
-- 「系统内不存在评选优秀与激励发放功能（页面无按钮、接口不存在）」。因此：
--   1. 不要为它写任何 Entity、Mapper、Service、Controller；
--   2. 不要在任何页面留入口；
--   3. 需求 13.9.3 的「激励类型」字典已删除，本表也就没有可用的类型字典。
--
-- 字段清单无来源可依——需求 11.7 原第 9–12 项（是否评选优秀、激励类型、激励发放状态、
-- 发放时间与发放人）在 V1.2 已被删除。这里按那四项的字面语义留最小结构，二期须按当时的
-- 需求重新审定。
-- -----------------------------------------------------------------------------
CREATE TABLE dtl_feedback_incentive
(
    id             BIGSERIAL PRIMARY KEY,
    feedback_id    BIGINT      NOT NULL REFERENCES dtl_training_feedback (id),
    incentive_type VARCHAR(32),
    grant_state    VARCHAR(16),
    granted_at     TIMESTAMPTZ,
    granted_by     VARCHAR(50),

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(50) NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by     VARCHAR(50),
    deleted        BOOLEAN     NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE dtl_feedback_incentive IS '激励发放记录。⚠ 一期不使用——评选优秀与激励发放整体推二期（N20、D32、验收点 A2-9）。不得为它写任何代码或界面入口';

CREATE INDEX idx_feedback_incentive_feedback ON dtl_feedback_incentive (feedback_id) WHERE deleted = FALSE;
