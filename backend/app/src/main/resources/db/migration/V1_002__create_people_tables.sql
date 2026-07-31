-- =============================================================================
-- V1_002__create_people_tables.sql
--
-- 阶段 1B：人员模块 2 张表（开发实施文档 6.2.1，V1.1 从 6 张减到 2 张）。
--
-- 已删除的 4 张表不要建：org_department（组织架构整体不做，N18）、sys_user（两个共享账号的
-- 凭据放配置文件）、sys_object_delegate（代理机制删除，N19）、sys_role_flag（账号类型是配置
-- 常量不是数据）。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- org_employee　人员台账（需求 14.3）
--
-- 一期它是一张纯粹的「工号—姓名—在职状态」对照表，不承载任何权限含义。
-- 能不能写数据取决于用哪个共享账号登录，与你在这张表里是谁完全无关（需求 14.3、C04）。
--
-- 不要因为「组织架构不做了」就顺手删掉它（开发 6.2.1）：签到导入、参训名单、讲师、
-- 两类反馈导入都要靠工号校验人员是否存在，这是导入校验的唯一依据。
--
-- 已删除的三列不要建：WeLink账号、公众号OpenID（系统不对接任何消息渠道）、
-- 是否运营角色（C04，账号与人员表完全解耦）。
-- -----------------------------------------------------------------------------
CREATE TABLE org_employee
(
    id            BIGSERIAL PRIMARY KEY,
    employee_no   VARCHAR(50)  NOT NULL,
    employee_name VARCHAR(50)  NOT NULL,
    dept_name     VARCHAR(50)  NOT NULL,
    position      VARCHAR(100),
    email         VARCHAR(100),
    person_type   VARCHAR(16)  NOT NULL,
    person_state  VARCHAR(16)  NOT NULL,
    import_batch_no VARCHAR(64),

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(50)  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by    VARCHAR(50),
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_employee_no UNIQUE (employee_no),
    CONSTRAINT ck_employee_person_type CHECK (person_type IN ('讲师', '学员', '两者')),
    CONSTRAINT ck_employee_person_state CHECK (person_state IN ('在职', '离职'))
);

COMMENT ON TABLE org_employee IS '人员台账（需求 14.3）。纯名录，不承载权限含义；导入这张表不会给任何人开通登录权限';
COMMENT ON COLUMN org_employee.employee_no IS '工号。人员导入的唯一键，工号已存在则更新其余全部字段（需求 14.3 导入行为）';
COMMENT ON COLUMN org_employee.dept_name IS '所属部门。V1.2 改为自由文本不校验（N18），仅用于列表展示与筛选';
COMMENT ON COLUMN org_employee.email IS '邮箱。一期不用于发送（MSG1），仅作为运营线下联系的参考信息';
COMMENT ON COLUMN org_employee.person_type IS '人员类型（需求 14.3，D18）。填「讲师」或「两者」时可被选为授课讲师';
COMMENT ON COLUMN org_employee.person_state IS '人员状态。离职人员不可被新选为负责人或讲师，但保留其历史签到与反馈记录（需求 14.3）';
COMMENT ON COLUMN org_employee.import_batch_no IS '导入批次号，支持整批撤销（需求 13.8.5）';

-- 负责人下拉、讲师下拉都按状态过滤后按姓名搜索
CREATE INDEX idx_employee_state_name ON org_employee (person_state, employee_name) WHERE deleted = FALSE;
CREATE INDEX idx_employee_batch ON org_employee (import_batch_no) WHERE deleted = FALSE;
-- 人员台账列表按部门筛选（N18 之后部门只剩这一个用途）
CREATE INDEX idx_employee_dept ON org_employee (dept_name) WHERE deleted = FALSE;


-- -----------------------------------------------------------------------------
-- sys_login_log　登录记录（开发 6.2.1）
--
-- 共享账号下这张表的价值有限但不为零：它是「有多少台机器在用运营账号」的唯一线索，
-- 与 audit_op_log.operator_ip 一起构成共享账号下的粗粒度追溯能力（需求 AC1）。
--
-- 追加写、不删除，与两张审计日志同理，因此不套公共字段模板。
-- -----------------------------------------------------------------------------
CREATE TABLE sys_login_log
(
    id           BIGSERIAL PRIMARY KEY,
    -- 可为空：登录失败且用户名不匹配任一共享账号时，账号类型无从判断。
    -- 这种行恰恰是最值得留的——它说明有人在猜用户名，而写成 NOT NULL 就只能把这类记录丢掉。
    account_type VARCHAR(16),
    login_ip     VARCHAR(64) NOT NULL,
    user_agent   VARCHAR(500),
    success      BOOLEAN     NOT NULL,
    fail_reason  VARCHAR(200),
    logged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_login_log_account_type CHECK (account_type IS NULL OR account_type IN ('OPS', 'USER'))
);

COMMENT ON TABLE sys_login_log IS '登录记录（开发 6.2.1）。记录账号类型、时间、IP';
COMMENT ON COLUMN sys_login_log.account_type IS '登录的共享账号类型：OPS = 运营，USER = 用户。登录失败且用户名不匹配任一账号时为空';
COMMENT ON COLUMN sys_login_log.success IS '登录是否成功。失败记录用于发现口令被猜测的迹象';
COMMENT ON COLUMN sys_login_log.fail_reason IS '失败原因。不得写入任何口令内容（规则 SEC4）';

CREATE INDEX idx_login_log_time ON sys_login_log (logged_at DESC);
