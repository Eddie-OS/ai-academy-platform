-- =============================================================================
-- 造数脚本。《开发实施文档》8.4 明确：这个脚本是后续全部阶段的基础设施，不是可选项。
--
-- 阶段 1 版本：100 条人员台账 + 1 条带完整状态停滞特征的需求。
-- 阶段 0 时人员数据落在骨架示例表上，真实表建好后目标表换成 org_employee 与 biz_demand，
-- 结构与规模不变（V1_009 已 DROP 骨架表）。
--
-- 数据量对齐 4.4.2 的本地开发环境要求（阶段 2 起扩展到课程 200、场次 500、签到 2 万）。
--
-- 与导入的关系：本脚本直接写表、不走导入接口，因此不写 import_batch_no——
-- 这些行不属于任何批次，撤销功能看不到它们，也不该看到。要测导入就走导入接口。
--
-- 幂等：可以反复执行。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 100 条人员台账
-- 工号 E0001～E0100，部门按需求文档 13.9.3 的 5 个作战单元轮转分配。
-- 用 generate_series 而不是 100 行 INSERT：改规模只要改一个数字。
--
-- 第 5、10、15… 号是离职：离职人员必须占一定比例，否则「离职负责人警告」（需求 14.3）、
-- 「离职人员不可新选为讲师」这类规则在本地开发时永远走不到。
-- -----------------------------------------------------------------------------
INSERT INTO org_employee (employee_no, employee_name, dept_name, position, email,
                          person_type, person_state, created_by, created_at, updated_at)
SELECT
    'E' || LPAD(n::text, 4, '0')                                          AS employee_no,
    '测试人员' || n                                                        AS employee_name,
    (ARRAY['AI需求', '课程', '讲师', '培训', '案例'])[1 + (n % 5)]           AS dept_name,
    (ARRAY['专员', '主管', '工程师', '经理', '顾问'])[1 + (n % 5)]           AS position,
    'e' || LPAD(n::text, 4, '0') || '@example.com'                         AS email,
    (ARRAY['学员', '学员', '讲师', '两者', '学员'])[1 + (n % 5)]            AS person_type,
    CASE WHEN n % 5 = 0 THEN '离职' ELSE '在职' END                         AS person_state,
    'operator'                                                            AS created_by,
    NOW() - (n || ' days')::interval                                      AS created_at,
    NOW() - (n || ' days')::interval                                      AS updated_at
FROM generate_series(1, 100) AS n
ON CONFLICT (employee_no) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 1 条需求，刻意让 updated_at 是今天、last_state_changed_at 是 12 天前。
--
-- 这正是需求 L1 与 C6 要区分的场景 —— 对象今天刚被编辑过（改了个错别字），
-- 但状态已经停滞 12 天，红灯必须仍然亮着。E1-3 的反向测试用的就是这种数据形态。
--
-- 出口二（造工具需求开发）+ 开发中：五个状态机里唯一能同时体现「已评审」与「开发中」
-- 并行的组合，一个 state 字段的建模在这里就露馅了（V1_003 表头注释）。
-- -----------------------------------------------------------------------------
INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, proposer_dept,
                        owner_no, proposed_date, expect_finish_date, description,
                        demand_source, demand_type, priority,
                        review_state, review_date, outlet, dev_state,
                        created_by, created_at, updated_at, updated_by,
                        last_state_changed_at, version)
VALUES ('XQ2026070001',
        '示例需求（状态停滞 12 天，今日被编辑过）',
        'AI_DEMAND',
        'E0007', 'AI需求',
        'E0001',
        CURRENT_DATE - 40,
        CURRENT_DATE + 3,
        '造数脚本生成。用于验证 C5／C6 两个时间字段不可合并：今天编辑过，但状态停滞 12 天，红灯仍亮。',
        '部门提出', '效率提升', '高',
        '已评审', CURRENT_DATE - 30,
        '造工具需求开发', '开发中',
        'operator',
        NOW() - INTERVAL '40 days',
        NOW(),
        'operator',
        NOW() - INTERVAL '12 days',
        3)
ON CONFLICT (demand_no) DO NOTHING;

COMMIT;

-- 造数结果自检
SELECT person_state,
       COUNT(*) AS total
FROM org_employee
WHERE deleted = FALSE
GROUP BY person_state
ORDER BY person_state;

SELECT demand_no,
       review_state,
       dev_state,
       (CURRENT_DATE - last_state_changed_at::date) AS 状态停滞天数,
       (CURRENT_DATE - updated_at::date)            AS 距最后编辑天数
FROM biz_demand
WHERE deleted = FALSE
ORDER BY demand_no;
