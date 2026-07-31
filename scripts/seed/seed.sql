-- =============================================================================
-- 造数脚本。《开发实施文档》8.4 明确：这个脚本是后续全部阶段的基础设施，不是可选项。
--
-- 阶段 0 版本：生成 100 条人员数据 + 1 条带完整状态流转历史的示例业务对象。
-- 阶段 0 还没有 org_employee 与 15 个状态机，因此人员数据先落在骨架示例表上；
-- 阶段 1 建完真实表后，把 INSERT 的目标表换成 org_employee 与各业务表即可，
-- 结构与规模都不用改。
--
-- 数据量对齐 4.4.2 的本地开发环境要求（阶段 2 起扩展到课程 200、场次 500、签到 2 万）。
--
-- 幂等：可以反复执行。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 100 条人员数据
-- 工号 E0001～E0100，按需求文档附录 A 第 11 项的 5 个作战单元轮转分配。
-- 用 generate_series 而不是 100 行 INSERT：改规模只要改一个数字。
-- -----------------------------------------------------------------------------
INSERT INTO sys_skeleton_sample (sample_no, sample_name, sample_state, owner_no,
                                 expect_finish_date, created_by, created_at, updated_at,
                                 last_state_changed_at, version, deleted)
SELECT
    'E' || LPAD(n::text, 4, '0')                                   AS sample_no,
    '测试人员' || n                                                 AS sample_name,
    (ARRAY['在职', '在职', '在职', '在职', '离职'])[1 + (n % 5)]     AS sample_state,
    'E0001'                                                        AS owner_no,
    NULL::date                                                     AS expect_finish_date,
    'operator'                                                     AS created_by,
    NOW() - (n || ' days')::interval                               AS created_at,
    NOW() - (n || ' days')::interval                               AS updated_at,
    NULL::timestamptz                                              AS last_state_changed_at,
    0                                                              AS version,
    FALSE                                                          AS deleted
FROM generate_series(1, 100) AS n
ON CONFLICT (sample_no) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 1 条示例业务对象。
--
-- 刻意让它的 updated_at 是今天、last_state_changed_at 是 12 天前：
-- 这正是需求 L1 与 C6 要区分的场景 —— 对象昨天刚被编辑过（改了个错别字），
-- 但状态已经停滞 12 天，红灯必须仍然亮着。阶段 1 的 E1-3 反向测试会用到这条数据。
-- -----------------------------------------------------------------------------
INSERT INTO sys_skeleton_sample (sample_no, sample_name, sample_state, owner_no,
                                 expect_finish_date, created_by, created_at, updated_at,
                                 updated_by, last_state_changed_at, version, deleted)
VALUES ('SAMPLE-0001',
        '示例业务对象（状态停滞 12 天，今日被编辑过）',
        '开发中',
        'E0007',
        CURRENT_DATE + 3,
        'operator',
        NOW() - INTERVAL '40 days',
        NOW(),
        'operator',
        NOW() - INTERVAL '12 days',
        3,
        FALSE)
ON CONFLICT (sample_no) DO NOTHING;

COMMIT;

-- 造数结果自检
SELECT sample_state, COUNT(*) AS total
FROM sys_skeleton_sample
WHERE deleted = FALSE
GROUP BY sample_state
ORDER BY sample_state;
