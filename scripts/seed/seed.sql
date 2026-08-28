-- =============================================================================
-- 造数脚本。《开发实施文档》8.4 明确：这个脚本是后续全部阶段的基础设施，不是可选项。
--
-- 阶段 1 版本：100 条人员台账 + 1 条带完整状态停滞特征的需求 + 1 条可导入反馈的培训场次。
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

-- -----------------------------------------------------------------------------
-- 一条最小的培训链路：课程 → 培训计划 → 讲师 → 培训场次。
--
-- 造它的唯一动因是**两类反馈导入在空库下一行也导不进去**：反馈行必须挂在一个
-- 已开课／已结束／已归档的场次上（需求 14.6 A 列）。阶段 1 还没有场次维护界面
-- （那是阶段 2 的培训驾驶舱），因此这条链路只能由造数脚本直接写表。
--
-- 场次号固定为 JH2026070001-01：人工验收动作 5（匿名反馈工号列为 NULL）要拿它当入参，
-- 随机生成的话每次验收都得先查一次库。
--
-- 场次状态取「已结束」而不是「已开课」：反馈通常在结束后才收齐，这也是需求 14.6
-- 允许「已结束」的原因。用它做验收数据，顺带覆盖了这个状态分支。
-- -----------------------------------------------------------------------------
INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                        initiated_date, expect_publish_date, validity_period,
                        main_state, publish_state, created_by, created_at, updated_at)
VALUES ('KC2026070001', '示例课程（供培训场次挂载）', '内部端到端课程', 'GTM', 'E0001',
        CURRENT_DATE - 60, CURRENT_DATE - 20, '12 个月',
        '发布', '已发布', 'operator', NOW() - INTERVAL '60 days', NOW() - INTERVAL '20 days')
ON CONFLICT (course_no) DO NOTHING;

-- E0002 是造数生成的在职讲师（person_type = 讲师）。讲师表与人员台账是两张表，
-- 讲师身份不由人员台账的 person_type 决定（C04：台账不承载权限与身份）。
INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                          expertise_domains, teaching_direction, join_type, joined_date,
                          training_state, trial_qualified, pool_state,
                          created_by, created_at, updated_at)
SELECT 'JS2026070001', e.employee_name, e.employee_no, e.dept_name,
       '["GTM"]'::jsonb, '内部端到端课程', '运营手动添加', CURRENT_DATE - 90,
       '可上岗', TRUE, '在池',
       'operator', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'
FROM org_employee e
WHERE e.employee_no = 'E0002'
ON CONFLICT (lecturer_no) DO NOTHING;

INSERT INTO biz_training_plan (plan_no, plan_name, course_id, owner_no, target_scope,
                               plan_start_date, plan_end_date, plan_state,
                               created_by, created_at, updated_at)
SELECT 'PX2026070001', '示例培训计划', c.id, 'E0001', '全员',
       CURRENT_DATE - 30, CURRENT_DATE + 30, '执行中',
       'operator', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'
FROM biz_course c
WHERE c.course_no = 'KC2026070001'
ON CONFLICT (plan_no) DO NOTHING;

INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id, lecturer_id,
                                  training_date, start_time, end_time, duration_hours,
                                  training_form, venue, student_scope, plan_attendee_count,
                                  session_state, created_by, created_at, updated_at,
                                  last_state_changed_at)
SELECT 'JH2026070001-01', p.id, '示例培训场次（已结束，可导入反馈）', c.id, l.id,
       CURRENT_DATE - 7, '14:00', '16:00', 2.0,
       '线下', '培训室 A', '全员', 30,
       '已结束', 'operator', NOW() - INTERVAL '20 days', NOW() - INTERVAL '7 days',
       NOW() - INTERVAL '7 days'
FROM biz_training_plan p
         JOIN biz_course c ON c.course_no = 'KC2026070001'
         JOIN biz_lecturer l ON l.lecturer_no = 'JS2026070001'
WHERE p.plan_no = 'PX2026070001'
ON CONFLICT (session_no) DO NOTHING;

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

SELECT s.session_no,
       s.session_state,
       l.lecturer_name AS 讲师,
       c.course_no     AS 课程
FROM biz_training_session s
         JOIN biz_lecturer l ON l.id = s.lecturer_id
         JOIN biz_course c ON c.id = s.course_id
WHERE s.deleted = FALSE
ORDER BY s.session_no;
