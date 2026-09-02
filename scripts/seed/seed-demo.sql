-- =============================================================================
-- 日常演示造数：五个业务模块各 20 条，覆盖全部状态与主要从表，灯色蓝／黄／红都有。
--
-- 由 seed.ps1 在 seed.sql（20 名人员）之后执行。可反复跑：先清演示／性能数据再插入。
-- 场次号 JH2026070001-01 固定留给反馈导入验收。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 清性能造数 + 上一轮演示数据（从表先于主表）
-- -----------------------------------------------------------------------------
DELETE FROM dtl_case_view WHERE case_id IN (
    SELECT id FROM biz_case WHERE case_no LIKE 'PERF-%' OR case_no LIKE 'AL202607%');
DELETE FROM dtl_case_like WHERE case_id IN (
    SELECT id FROM biz_case WHERE case_no LIKE 'PERF-%' OR case_no LIKE 'AL202607%');
DELETE FROM dtl_case_comment WHERE case_id IN (
    SELECT id FROM biz_case WHERE case_no LIKE 'PERF-%' OR case_no LIKE 'AL202607%');

DELETE FROM dtl_attendance WHERE session_id IN (
    SELECT id FROM biz_training_session WHERE session_no LIKE 'PERF-%' OR session_no LIKE 'JH202607%');
DELETE FROM dtl_session_attendee WHERE session_id IN (
    SELECT id FROM biz_training_session WHERE session_no LIKE 'PERF-%' OR session_no LIKE 'JH202607%');
DELETE FROM dtl_student_evaluation WHERE session_id IN (
    SELECT id FROM biz_training_session WHERE session_no LIKE 'PERF-%' OR session_no LIKE 'JH202607%');
DELETE FROM dtl_teaching_record WHERE session_id IN (
    SELECT id FROM biz_training_session WHERE session_no LIKE 'PERF-%' OR session_no LIKE 'JH202607%');
DELETE FROM dtl_training_feedback WHERE session_id IN (
    SELECT id FROM biz_training_session WHERE session_no LIKE 'PERF-%' OR session_no LIKE 'JH202607%');
DELETE FROM dtl_training_archive WHERE session_id IN (
    SELECT id FROM biz_training_session WHERE session_no LIKE 'PERF-%' OR session_no LIKE 'JH202607%');

DELETE FROM dtl_course_review WHERE course_id IN (
    SELECT id FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%');
DELETE FROM dtl_trial_feedback WHERE trial_id IN (
    SELECT t.id FROM dtl_course_trial t
    JOIN biz_course c ON c.id = t.course_id
    WHERE c.course_no LIKE 'KC202607%' OR c.course_no LIKE 'PERF-%');
DELETE FROM dtl_course_trial WHERE course_id IN (
    SELECT id FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%');
DELETE FROM dtl_course_selfcheck WHERE course_id IN (
    SELECT id FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%');
DELETE FROM dtl_course_schedule WHERE course_id IN (
    SELECT id FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%');
DELETE FROM dtl_selfcheck_snapshot WHERE version_id IN (
    SELECT v.id FROM dtl_course_material_version v
    JOIN biz_course c ON c.id = v.course_id
    WHERE c.course_no LIKE 'KC202607%' OR c.course_no LIKE 'PERF-%');
DELETE FROM dtl_course_material_version_file WHERE version_id IN (
    SELECT v.id FROM dtl_course_material_version v
    JOIN biz_course c ON c.id = v.course_id
    WHERE c.course_no LIKE 'KC202607%' OR c.course_no LIKE 'PERF-%');
DELETE FROM dtl_course_material_version WHERE course_id IN (
    SELECT id FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%');
DELETE FROM dtl_course_material WHERE course_id IN (
    SELECT id FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%');

DELETE FROM audit_state_log WHERE object_type = 'COURSE' AND object_id IN (
    SELECT id FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%');
DELETE FROM audit_state_log WHERE object_type = 'DEMAND' AND object_id IN (
    SELECT id FROM biz_demand WHERE description LIKE '【造数】%' OR demand_no LIKE 'XQ2026%');
DELETE FROM dtl_demand_review WHERE demand_id IN (
    SELECT id FROM biz_demand WHERE description LIKE '【造数】%' OR demand_no LIKE 'XQ2026%');
DELETE FROM dtl_demand_acceptance WHERE demand_id IN (
    SELECT id FROM biz_demand WHERE description LIKE '【造数】%' OR demand_no LIKE 'XQ2026%');
DELETE FROM rel_demand_course WHERE demand_id IN (
    SELECT id FROM biz_demand WHERE description LIKE '【造数】%' OR demand_no LIKE 'XQ2026%');
DELETE FROM rel_demand_course WHERE course_id IN (
    SELECT id FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%');

DELETE FROM snapshot_warning_light WHERE object_type IN ('DEMAND', 'COURSE', 'TRAINING_PLAN')
    AND object_id IN (
        SELECT id FROM biz_demand
        UNION ALL SELECT id FROM biz_course
        UNION ALL SELECT id FROM biz_training_plan);

DELETE FROM sys_task WHERE object_type IN ('DEMAND', 'COURSE', 'TRAINING_PLAN', 'TRAINING_SESSION', 'CASE')
    AND object_id IN (
        SELECT id FROM biz_demand
        UNION ALL SELECT id FROM biz_course
        UNION ALL SELECT id FROM biz_training_plan
        UNION ALL SELECT id FROM biz_training_session
        UNION ALL SELECT id FROM biz_case);

DELETE FROM biz_training_session WHERE session_no LIKE 'PERF-%' OR session_no LIKE 'JH202607%';
DELETE FROM biz_training_plan WHERE plan_no LIKE 'PERF-%' OR plan_no LIKE 'PX202607%';
DELETE FROM biz_case WHERE case_no LIKE 'PERF-%' OR case_no LIKE 'AL202607%';
DELETE FROM biz_demand WHERE description LIKE '【造数】%' OR demand_no LIKE 'XQ2026%';
DELETE FROM biz_course WHERE course_no LIKE 'PERF-%' OR course_no LIKE 'KC202607%';
DELETE FROM biz_lecturer WHERE lecturer_no LIKE 'JS202607%' OR lecturer_no LIKE 'JS202608%';
DELETE FROM dtl_attendance WHERE employee_no LIKE 'PERF-E%';
DELETE FROM org_employee WHERE employee_no LIKE 'PERF-E%';
DELETE FROM org_employee
 WHERE employee_no ~ '^E[0-9]{4}$'
   AND employee_no > 'E0020';

-- -----------------------------------------------------------------------------
-- 课程 20：12 个主状态各至少 1 条，外加过期／临期／蓝黄红灯
-- last_state_changed_at 多数在 5 天内，避免整库被停滞规则打成红灯
-- -----------------------------------------------------------------------------
INSERT INTO biz_course (
    course_no, course_name, review_track, domain_code, owner_no,
    initiated_date, expect_publish_date, validity_period, validity_end_date,
    main_state, dev_state, selfcheck_state, trial_state, publish_state,
    first_publish_date, quality_marks,
    created_by, created_at, updated_at, last_state_changed_at, version)
SELECT
    'KC202607' || LPAD(n::text, 4, '0'),
    (ARRAY[
        '智能教案生成实战', '学员能力画像工作坊', 'AI 助教问答调优',
        '课程标签体系落地', '讲师试讲辅导课', '培训报表解读',
        '示例课程（供培训场次挂载）', '案例库检索技巧', '需求评审工作坊',
        '解决方案交付工作坊', '业务验收沟通技巧', '已关闭的早期课程',
        '已过期发布课', '临期发布课', '停滞开发课',
        '逾期评审课', '第二门试讲课', '第二门立项课',
        '第二门推广课', '第二门精品课'
    ])[n],
    CASE WHEN n % 2 = 0 THEN '周边领域课程' ELSE '内部端到端课程' END,
    (ARRAY['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'])[1 + ((n - 1) % 7)],
    'E' || LPAD((1 + ((n - 1) % 16))::text, 4, '0'),
    CURRENT_DATE - (80 - n),
    CASE
        WHEN n IN (2, 16) THEN CURRENT_DATE - 4
        WHEN n IN (4, 6) THEN CURRENT_DATE + 2
        ELSE CURRENT_DATE + (12 + n)
    END,
    CASE WHEN n = 13 THEN '3 个月' WHEN n = 14 THEN '6 个月' ELSE '12 个月' END,
    CASE
        WHEN n = 13 THEN CURRENT_DATE - 10
        WHEN n = 14 THEN CURRENT_DATE + 20
        WHEN n IN (7, 8, 9, 10, 19, 20) THEN CURRENT_DATE + 300
        ELSE NULL
    END,
    (ARRAY[
        '立项', '开发', '自检', '评审决策', '试讲', '优化',
        '发布', '推广', '精品案例', '案例归档', '课程归档', '已关闭',
        '发布', '发布', '开发', '评审决策', '试讲', '立项', '推广', '精品案例'
    ])[n],
    CASE
        WHEN n IN (2, 15) THEN '开发中'
        WHEN n = 3 THEN '自检中'
        WHEN n IN (1, 18) THEN '待开发'
        ELSE NULL
    END,
    CASE WHEN n = 3 THEN '自检完成' ELSE NULL END,
    CASE WHEN n IN (5, 17) THEN '待试讲' ELSE NULL END,
    CASE WHEN n IN (7, 8, 9, 10, 13, 14, 19, 20) THEN '已发布' ELSE NULL END,
    CASE WHEN n IN (7, 8, 9, 10, 13, 14, 19, 20) THEN CURRENT_DATE - 40 ELSE NULL END,
    CASE WHEN n IN (9, 20) THEN '["精品"]'::jsonb ELSE NULL END,
    'operator',
    NOW() - ((80 - n) || ' days')::interval,
    NOW() - INTERVAL '1 day',
    CASE
        WHEN n = 15 THEN NOW() - INTERVAL '10 days'
        WHEN n IN (2, 16) THEN NOW() - INTERVAL '2 days'
        ELSE NOW() - INTERVAL '1 day'
    END,
    1
FROM generate_series(1, 20) AS n;

-- -----------------------------------------------------------------------------
-- 课程状态流转日志：按当前主状态回放官方机路径（只写日志，不改五个状态列）
-- 子状态随主状态置位的记 SYSTEM；效率指标取首次到达，时间落在 created_at～last_state_changed_at
-- -----------------------------------------------------------------------------
INSERT INTO audit_state_log (object_type, object_id, state_field, from_state, to_state,
                             action_code, account_type, changed_at, remark)
SELECT 'COURSE', p.id, p.state_field, p.from_state, p.to_state, p.action_code, p.account_type,
       CASE
           WHEN p.rn = 1 THEN p.created_at
           WHEN p.rn = p.cnt THEN p.last_state_changed_at
           ELSE p.created_at
                + (p.last_state_changed_at - p.created_at) * (p.rn - 1) / (p.cnt - 1)
       END,
       p.remark
FROM (
    SELECT c.id, c.created_at, c.last_state_changed_at,
           h.state_field, h.from_state, h.to_state, h.action_code, h.account_type, h.remark,
           ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY h.seq) AS rn,
           COUNT(*) OVER (PARTITION BY c.id) AS cnt
    FROM biz_course c
    JOIN (
        VALUES
            (10, ARRAY['立项','开发','自检','评审决策','试讲','优化','发布','推广','精品案例','案例归档','课程归档','已关闭']::text[],
             '课程主状态', NULL, '立项', 'INITIATE', 'OPS', '课程立项'),
            (20, ARRAY['开发','自检','评审决策','试讲','优化','发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程主状态', '立项', '开发', 'START_DEVELOP', 'OPS', '线下会后开工'),
            (21, ARRAY['开发','自检','评审决策','试讲','优化','发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程开发状态', NULL, '待开发', 'MAIN_STATE_ENTERED_DEVELOP', 'SYSTEM', '随主状态进入开发'),
            (22, ARRAY['开发','自检','评审决策','试讲','优化','发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程开发状态', '待开发', '开发中', 'START_DEVELOP', 'OPS', '开始开发'),
            (30, ARRAY['自检','评审决策','试讲','优化','发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程主状态', '开发', '自检', 'ENTER_SELF_CHECK', 'OPS', '开发完成，进入自检'),
            (31, ARRAY['自检','评审决策','试讲','优化','发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程开发状态', '开发中', '自检中', 'ENTER_SELF_CHECK', 'SYSTEM', '随主状态进入自检'),
            (32, ARRAY['自检']::text[],
             '课程自检状态', NULL, '自检完成', 'COMPLETE_ALL_ITEMS', 'OPS', '全部清单项勾选完成'),
            (40, ARRAY['评审决策','试讲','优化','发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程主状态', '自检', '评审决策', 'SUBMIT_REVIEW', 'OPS', '材料齐套，提交评审'),
            (50, ARRAY['试讲','发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程主状态', '评审决策', '试讲', 'REVIEW_PASS', 'OPS', '评审通过，进入试讲'),
            (51, ARRAY['试讲','发布','推广','精品案例','案例归档','课程归档']::text[],
             '试讲状态', NULL, '待试讲', 'MAIN_STATE_ENTERED_TRIAL', 'SYSTEM', '随主状态进入试讲'),
            (55, ARRAY['优化']::text[],
             '课程主状态', '评审决策', '优化', 'REVIEW_REJECT_REVISE', 'OPS', '评审不通过，修改后重新评审'),
            (60, ARRAY['发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程主状态', '试讲', '发布', 'TRIAL_COURSE_PASS', 'OPS', '试讲合格，进入发布'),
            (61, ARRAY['发布','推广','精品案例','案例归档','课程归档']::text[],
             '课程发布状态', NULL, '已发布', 'MAIN_STATE_ENTERED_PUBLISH', 'SYSTEM', '随主状态进入发布'),
            (70, ARRAY['推广','精品案例','案例归档','课程归档']::text[],
             '课程主状态', '发布', '推广', 'ENTER_PROMOTION', 'OPS', '进入推广'),
            (80, ARRAY['精品案例','案例归档']::text[],
             '课程主状态', '推广', '精品案例', 'MARK_QUALIFIED', 'OPS', '标注达到精品标准'),
            (85, ARRAY['课程归档']::text[],
             '课程主状态', '推广', '课程归档', 'MARK_NOT_QUALIFIED', 'OPS', '未达精品标准，课程归档'),
            (90, ARRAY['案例归档']::text[],
             '课程主状态', '精品案例', '案例归档', 'ARCHIVE_AFTER_CASE_PUBLISHED', 'OPS', '案例上架后归档'),
            (95, ARRAY['已关闭']::text[],
             '课程主状态', '立项', '已关闭', 'CLOSE_DEVELOPMENT', 'OPS', '线下判定不做，关闭课程开发')
    ) AS h(seq, states, state_field, from_state, to_state, action_code, account_type, remark)
      ON c.main_state = ANY (h.states)
    WHERE c.deleted = FALSE AND c.course_no LIKE 'KC202607%'
) p;

-- -----------------------------------------------------------------------------
-- 讲师 20：培养三态 × 在池／移出、三种入池方式、试讲合格有无。场次只用「可上岗+在池」
-- -----------------------------------------------------------------------------
INSERT INTO biz_lecturer (
    lecturer_no, lecturer_name, employee_no, source_dept,
    expertise_domains, teaching_direction, join_type, joined_date,
    training_state, trial_qualified, first_qualified_date, pool_state, removed_reason,
    created_by, created_at, updated_at)
SELECT
    'JS202607' || LPAD(n::text, 4, '0'),
    e.employee_name,
    e.employee_no,
    e.dept_name,
    ('["' || (ARRAY['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'])[1 + ((n - 1) % 7)] || '"]')::jsonb,
    (ARRAY['内部端到端课程', '周边领域课程', '培训运营', '案例提炼', '需求评审'])[1 + ((n - 1) % 5)],
    (ARRAY['运营手动添加', '批量导入', '课程开发人员自动入池'])[1 + ((n - 1) % 3)],
    CURRENT_DATE - (90 - n),
    CASE
        WHEN n <= 5 THEN '可上岗'
        WHEN n <= 10 THEN '培养中'
        ELSE '待培养'
    END,
    n <= 4,
    CASE WHEN n <= 4 THEN CURRENT_DATE - 40 ELSE NULL END,
    CASE WHEN n <= 14 THEN '在池' ELSE '已移出' END,
    CASE WHEN n > 14 THEN '演示：移出讲师池' ELSE NULL END,
    'operator',
    NOW() - ((90 - n) || ' days')::interval,
    NOW() - INTERVAL '1 day'
FROM generate_series(1, 20) AS n
JOIN org_employee e ON e.employee_no = 'E' || LPAD(n::text, 4, '0') AND e.deleted = FALSE;

-- -----------------------------------------------------------------------------
-- 需求 20：评审三态、两条出口、开发五态、交付／验收、蓝黄红（逾期+停滞）
-- n=1：今日编辑、停滞 12 天（C5／C6）
-- -----------------------------------------------------------------------------
INSERT INTO biz_demand (
    demand_no, demand_name, domain_code, proposer_no, proposer_dept, owner_no, owner_names,
    proposed_date, expect_finish_date, description,
    business_background, roi_analysis, remark,
    demand_source, demand_type, priority,
    review_state, review_date, review_conclusion, review_opinion,
    outlet, solution_state, solution_name, dev_state,
    first_online_date, latest_online_date, optimize_count,
    delivery_mark, delivered_at, archived_at,
    acceptance_state, acceptor_name, accepted_at, acceptance_opinion, acceptance_round,
    created_by, created_at, updated_at, updated_by, last_state_changed_at, version)
SELECT
    'XQ202607' || LPAD(n::text, 4, '0'),
    (ARRAY[
        '三色灯阈值说明浮层', '课程有效期到期提醒优化', '总结报告章节模板',
        '需求评审会议纪要沉淀', '分流出口录入体验改进', '业务验收结论结构化',
        '催办台账筛选增强', '试讲反馈模板标准化', '培训场次签到补录',
        '参训名单批量导入校验', '学员评价维度扩展', '案例点赞评论风控',
        '智能教案生成增强需求', '学员能力画像优化需求', 'AI助教问答准确率提升',
        '课程标签体系扩展需求', '讲师能力评估模型优化', '学习路径推荐算法升级',
        '企业培训报表自定义导出', '案例库智能检索优化'
    ])[n],
    (ARRAY['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'])[1 + ((n - 1) % 7)],
    'E' || LPAD((1 + ((n * 3) % 16))::text, 4, '0'),
    (ARRAY['AI需求', '课程', '讲师', '培训', '案例'])[1 + ((n - 1) % 5)],
    'E' || LPAD((1 + ((n * 7) % 16))::text, 4, '0'),
    'E' || LPAD((1 + ((n * 7) % 16))::text, 4, '0'),
    CURRENT_DATE - (40 + n),
    CASE
        WHEN n IN (1, 3, 19) THEN CURRENT_DATE - (2 + n % 5)
        WHEN n IN (2, 5, 20) THEN CURRENT_DATE + 2
        ELSE CURRENT_DATE + (12 + n)
    END,
    '【背景】一线登记「' || (ARRAY[
        '三色灯阈值说明浮层', '课程有效期到期提醒优化', '总结报告章节模板',
        '需求评审会议纪要沉淀', '分流出口录入体验改进', '业务验收结论结构化',
        '催办台账筛选增强', '试讲反馈模板标准化', '培训场次签到补录',
        '参训名单批量导入校验', '学员评价维度扩展', '案例点赞评论风控',
        '智能教案生成增强需求', '学员能力画像优化需求', 'AI助教问答准确率提升',
        '课程标签体系扩展需求', '讲师能力评估模型优化', '学习路径推荐算法升级',
        '企业培训报表自定义导出', '案例库智能检索优化'
    ])[n] || '」时的痛点。' || E'\n【目标】完成记录与可视化，不替线下做判断。'
        || E'\n【要求】字段与新建需求表单一致。'
        || CASE WHEN n = 1 THEN E'\n今日可改错别字，last_state_changed_at 仍停在 12 天前。' ELSE '' END,
    '【造数】业务背景：对应一线场景与痛点，n=' || n || '。',
    '【造数】定性：支撑运营记录；量化：一期不做自动测算。',
    '演示造数，字段与登记表单对齐。',
    (ARRAY['部门提出', '个人提出', '培训反馈', '案例反推', '战略任务'])[1 + ((n - 1) % 5)],
    (ARRAY['效率提升', '质量改善', '成本降低', '风险控制', '体验优化'])[1 + ((n - 1) % 5)],
    (ARRAY['P0（紧急重要）', 'P1（重要）', 'P2（一般）'])[1 + ((n - 1) % 3)],
    CASE WHEN n <= 3 THEN '待评审' WHEN n <= 5 THEN '评审中' ELSE '已评审' END,
    CASE WHEN n > 5 THEN CURRENT_DATE - 20 ELSE NULL END,
    CASE WHEN n > 5 THEN '同意推进，按出口执行' ELSE NULL END,
    CASE WHEN n > 5 THEN '评审会结论：范围清晰。' ELSE NULL END,
    CASE WHEN n <= 5 THEN NULL WHEN n <= 10 OR n = 20 THEN '用现有工具输出解决方案' ELSE '造工具需求开发' END,
    CASE
        WHEN n IN (6) THEN '已输出'
        WHEN n IN (7, 8, 9, 10, 20) THEN '已发布'
        ELSE NULL
    END,
    CASE WHEN n IN (6, 7, 8, 9, 10, 20) THEN '解决方案 v1' ELSE NULL END,
    CASE
        WHEN n = 11 THEN '已立项'
        WHEN n = 12 THEN '待开发'
        WHEN n IN (13, 19) THEN '开发中'
        WHEN n IN (14, 16, 17) THEN '已上线'
        WHEN n IN (15, 18) THEN '优化中'
        ELSE NULL
    END,
    CASE WHEN n IN (14, 15, 16, 17, 18) THEN CURRENT_DATE - 15 ELSE NULL END,
    CASE WHEN n IN (14, 15, 16, 17, 18) THEN CURRENT_DATE - 10 ELSE NULL END,
    CASE WHEN n IN (15, 18) THEN 1 ELSE 0 END,
    CASE
        WHEN n IN (8, 16) THEN '已交付'
        WHEN n IN (9, 10, 17) THEN '已归档'
        ELSE NULL
    END,
    CASE WHEN n IN (8, 9, 10, 16, 17) THEN CURRENT_DATE - 8 ELSE NULL END,
    CASE WHEN n IN (9, 10, 17) THEN CURRENT_DATE - 3 ELSE NULL END,
    CASE
        WHEN n IN (8, 16) THEN '待验收'
        WHEN n IN (9, 17) THEN '验收通过'
        WHEN n IN (10, 18) THEN '验收不通过'
        ELSE NULL
    END,
    CASE WHEN n IN (8, 9, 10, 16, 17, 18) THEN '业务接口人' ELSE NULL END,
    CASE WHEN n IN (9, 10, 17, 18) THEN CURRENT_DATE - 5 ELSE NULL END,
    CASE
        WHEN n IN (9, 17) THEN '线下验收通过。'
        WHEN n IN (10, 18) THEN '尚有缺口，退回修改。'
        ELSE NULL
    END,
    CASE WHEN n IN (10, 18) THEN 1 ELSE 0 END,
    'operator',
    NOW() - ((40 + n) || ' days')::interval,
    CASE WHEN n = 1 THEN NOW() ELSE NOW() - INTERVAL '1 day' END,
    'operator',
    CASE
        WHEN n = 1 THEN NOW() - INTERVAL '12 days'
        WHEN n = 19 THEN NOW() - INTERVAL '8 days'
        ELSE NOW() - INTERVAL '2 days'
    END,
    1 + (n % 3)
FROM generate_series(1, 20) AS n;

INSERT INTO dtl_demand_review (demand_id, round_no, review_date, review_conclusion, review_opinion,
                               created_by, created_at, updated_at)
SELECT d.id, 1, COALESCE(d.review_date, CURRENT_DATE - 10),
       d.review_conclusion,
       COALESCE(d.review_opinion, '评审进行中，结论待录入。'),
       'operator', COALESCE(d.review_date, CURRENT_DATE - 10)::timestamptz, NOW()
FROM biz_demand d
WHERE d.description LIKE '【造数】%' AND d.review_state IN ('评审中', '已评审');

INSERT INTO dtl_demand_acceptance (demand_id, round_no, acceptor_name, accepted_at,
                                   acceptance_result, acceptance_opinion,
                                   created_by, created_at, updated_at)
SELECT d.id, 1, d.acceptor_name, d.accepted_at,
       CASE WHEN d.acceptance_state = '验收通过' THEN '通过' ELSE '不通过' END,
       d.acceptance_opinion, 'operator', d.accepted_at::timestamptz, NOW()
FROM biz_demand d
WHERE d.description LIKE '【造数】%'
  AND d.acceptance_state IN ('验收通过', '验收不通过')
  AND d.accepted_at IS NOT NULL;

INSERT INTO audit_state_log (object_type, object_id, state_field, from_state, to_state,
                             action_code, account_type, changed_at, remark)
SELECT 'DEMAND', d.id, '需求评审状态', NULL, '待评审', 'REGISTER', 'OPS',
       d.created_at, '造数：登记需求'
FROM biz_demand d WHERE d.description LIKE '【造数】%';

INSERT INTO audit_state_log (object_type, object_id, state_field, from_state, to_state,
                             action_code, account_type, changed_at, remark)
SELECT 'DEMAND', d.id, '需求评审状态', '待评审', '评审中', 'START_REVIEW', 'OPS',
       d.created_at + INTERVAL '3 days', '造数：开始评审'
FROM biz_demand d
WHERE d.description LIKE '【造数】%' AND d.review_state IN ('评审中', '已评审');

INSERT INTO audit_state_log (object_type, object_id, state_field, from_state, to_state,
                             action_code, account_type, changed_at, remark)
SELECT 'DEMAND', d.id, '需求评审状态', '评审中', '已评审', 'RECORD_REVIEW_RESULT', 'OPS',
       COALESCE(d.review_date::timestamptz, d.created_at + INTERVAL '10 days'),
       '造数：录入评审结论'
FROM biz_demand d
WHERE d.description LIKE '【造数】%' AND d.review_state = '已评审';

INSERT INTO rel_demand_course (demand_id, course_id, created_at, created_by, link_note)
SELECT d.id, c.id, NOW() - INTERVAL '4 days', 'operator', '造数：该课程覆盖本需求主路径'
FROM biz_demand d
JOIN biz_course c ON c.course_no = 'KC202607' || LPAD(((d.id % 10) + 1)::text, 4, '0')
WHERE d.description LIKE '【造数】%' AND d.review_state = '已评审' AND d.id % 2 = 0
ON CONFLICT (demand_id, course_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 培训计划 20 + 场次 20，场次铺在 2026 年 9 月工作日。JH2026070001-01 已结束，可导入反馈
-- -----------------------------------------------------------------------------
INSERT INTO biz_training_plan (
    plan_no, plan_name, course_id, owner_no, target_scope,
    plan_start_date, plan_end_date, plan_session_count, plan_state, actual_finish_date,
    created_by, created_at, updated_at, last_state_changed_at)
SELECT
    'PX202607' || LPAD(n::text, 4, '0'),
    (ARRAY[
        '示例培训计划', '本周新开班', '临期执行计划', '逾期未开班计划',
        '进行中的大班', '进行中的小班', '进行中的混合班', '进行中的线上班',
        '第二场执行计划', '第三场执行计划', '第四场执行计划', '第五场执行计划',
        '第六场执行计划', '第七场执行计划', '已完成计划甲', '已完成计划乙',
        '已完成计划丙', '已完成计划丁', '已完成计划戊', '已完成计划己'
    ])[n],
    c.id,
    'E0001',
    '全员',
    DATE '2026-09-01',
    DATE '2026-09-30',
    1,
    CASE WHEN n = 1 THEN '执行中' WHEN n <= 4 THEN '待执行' WHEN n <= 14 THEN '执行中' ELSE '已完成' END,
    CASE WHEN n >= 15 THEN CURRENT_DATE - 5 ELSE NULL END,
    'operator',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '1 day',
    CASE
        WHEN n = 4 THEN NOW() - INTERVAL '8 days'
        ELSE NOW() - INTERVAL '2 days'
    END
FROM generate_series(1, 20) AS n
JOIN biz_course c ON c.course_no = 'KC202607' || LPAD(
    CASE WHEN n = 1 THEN 7 ELSE 1 + ((n - 1) % 8) + 6 END::text, 4, '0');

INSERT INTO biz_training_session (
    session_no, plan_id, session_name, course_id, lecturer_id,
    training_date, start_time, end_time, duration_hours,
    training_form, venue, student_scope, plan_attendee_count,
    session_state, created_by, created_at, updated_at, last_state_changed_at)
SELECT
    CASE WHEN n = 1 THEN 'JH2026070001-01'
         ELSE 'JH202607' || LPAD(n::text, 4, '0') || '-01' END,
    p.id,
    CASE WHEN n = 1 THEN '示例培训场次（已结束，可导入反馈）'
         ELSE p.plan_name || ' 第1场' END,
    p.course_id,
    l.id,
    (ARRAY[
        DATE '2026-09-01', DATE '2026-09-02', DATE '2026-09-03', DATE '2026-09-04',
        DATE '2026-09-07', DATE '2026-09-08', DATE '2026-09-09', DATE '2026-09-10',
        DATE '2026-09-11', DATE '2026-09-14', DATE '2026-09-15', DATE '2026-09-16',
        DATE '2026-09-17', DATE '2026-09-18', DATE '2026-09-21', DATE '2026-09-22',
        DATE '2026-09-23', DATE '2026-09-24', DATE '2026-09-25', DATE '2026-09-28'
    ])[n],
    (ARRAY['09:00','14:00','09:30','13:30','16:00']::time[])[1 + ((n - 1) % 5)],
    ((ARRAY['09:00','14:00','09:30','13:30','16:00']::time[])[1 + ((n - 1) % 5)] + INTERVAL '2 hours')::time,
    2.0,
    (ARRAY['线下', '线上', '混合'])[1 + ((n - 1) % 3)],
    '培训室 ' || chr(64 + 1 + ((n - 1) % 5)),
    '全员', 20,
    CASE WHEN n = 1 THEN '已结束'
         ELSE (ARRAY['待开课', '待开课', '待开课', '待开课', '待开课',
                     '已开课', '已开课', '已开课', '已开课', '已开课',
                     '已结束', '已结束', '已结束', '已结束', '已结束',
                     '已归档', '已归档', '已归档', '已归档', '已归档'])[n]
    END,
    'operator',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '2 days'
FROM generate_series(1, 20) AS n
JOIN biz_training_plan p ON p.plan_no = 'PX202607' || LPAD(n::text, 4, '0')
JOIN biz_lecturer l ON l.lecturer_no = 'JS202607' || LPAD((1 + ((n - 1) % 4))::text, 4, '0');

-- 已结束场次挂 12 条签到，够看参训人次，不必两万
INSERT INTO dtl_attendance (session_id, employee_no, employee_name_snapshot, attend_status,
                            created_by, created_at, updated_at)
SELECT s.id, e.employee_no, e.employee_name, '已签到', 'operator', NOW() - INTERVAL '7 days', NOW()
FROM biz_training_session s
JOIN generate_series(1, 12) AS n ON TRUE
JOIN org_employee e ON e.employee_no = 'E' || LPAD(n::text, 4, '0')
WHERE s.session_state IN ('已结束', '已归档')
  AND s.session_no LIKE 'JH202607%'
ON CONFLICT (session_id, employee_no) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 案例 20：四态各 5 条；两门精品课各挂 1 条；已上架带少量浏览／点赞／评论
-- -----------------------------------------------------------------------------
INSERT INTO biz_case (
    case_no, case_name, course_id, contributing_org, domain_codes, owner_no,
    case_state, reviewer_no, reviewed_at, review_opinion, review_result,
    quality_marks, content, published_at, expect_publish_date,
    created_by, created_at, updated_at, last_state_changed_at, version)
SELECT
    'AL202607' || LPAD(n::text, 4, '0'),
    (ARRAY[
        '教案生成落地案例', '能力画像试点总结', '助教问答调优纪要',
        '标签体系推广记录', '试讲辅导复盘', '报表解读实践',
        '检索技巧沉淀', '评审工作坊纪要', '交付工作坊纪要',
        '验收沟通案例', '过期课经验', '临期课应对',
        '停滞开发复盘', '逾期评审教训', '第二试讲记录',
        '立项阶段纪要', '推广阶段纪要', '精品课提炼甲',
        '精品课提炼乙', '已上架示范案例'
    ])[n],
    CASE WHEN n = 18 THEN c9.id WHEN n = 19 THEN c20.id ELSE NULL END,
    'AI学院',
    jsonb_build_array((ARRAY['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'])[1 + ((n - 1) % 7)]),
    'E0001',
    (ARRAY['待整理', '待整理', '待整理', '待整理', '待整理',
           '整理中', '整理中', '整理中', '整理中', '整理中',
           '待审核', '待审核', '待审核', '待审核', '待审核',
           '已上架', '已上架', '已上架', '已上架', '已上架'])[n],
    CASE WHEN n >= 11 THEN 'E0002' ELSE NULL END,
    CASE WHEN n >= 16 THEN CURRENT_DATE - 5 WHEN n >= 11 THEN CURRENT_DATE - 2 ELSE NULL END,
    CASE WHEN n >= 16 THEN '审核通过，准予上架。' WHEN n >= 11 THEN '待审。' ELSE NULL END,
    CASE WHEN n >= 16 THEN '通过' ELSE NULL END,
    CASE WHEN n >= 16 THEN '["精品"]'::jsonb ELSE NULL END,
    CASE WHEN n >= 16 THEN '【造数】已上架正文，供详情与互动演示。' ELSE '【造数】整理中的案例提纲。' END,
    CASE WHEN n >= 16 THEN NOW() - INTERVAL '5 days' ELSE NULL END,
    CASE
        WHEN n IN (11, 12) THEN CURRENT_DATE + 2
        WHEN n IN (13) THEN CURRENT_DATE - 3
        ELSE CURRENT_DATE + 15
    END,
    'operator',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '2 days',
    1
FROM generate_series(1, 20) AS n
LEFT JOIN biz_course c9 ON c9.course_no = 'KC2026070009'
LEFT JOIN biz_course c20 ON c20.course_no = 'KC2026070020';

INSERT INTO dtl_case_view (case_id, viewed_at, duration_seconds, account_type, source_ip)
SELECT c.id, NOW() - ((n) || ' days')::interval, 120 + n, 'USER', '10.0.0.' || n
FROM biz_case c
JOIN generate_series(1, 6) AS n ON TRUE
WHERE c.case_state = '已上架' AND c.case_no LIKE 'AL202607%';

INSERT INTO dtl_case_like (case_id, liked_at, account_type, source_ip)
SELECT c.id, NOW() - INTERVAL '2 days', 'USER', '10.0.0.20'
FROM biz_case c
WHERE c.case_state = '已上架' AND c.case_no LIKE 'AL202607%';

INSERT INTO dtl_case_comment (case_id, content, commented_at, deleted, account_type, signature,
                              created_by, created_at, updated_at)
SELECT c.id, '造数：这条评论用来点亮案例互动数。', NOW() - INTERVAL '1 day', FALSE, 'USER', '学员甲',
       'operator', NOW(), NOW()
FROM biz_case c
WHERE c.case_state = '已上架' AND c.case_no LIKE 'AL202607%';

COMMIT;

SELECT 'demo seed' AS status,
       (SELECT COUNT(*) FROM org_employee WHERE deleted = FALSE AND employee_no LIKE 'E0%') AS employees,
       (SELECT COUNT(*) FROM biz_demand WHERE deleted = FALSE) AS demands,
       (SELECT COUNT(*) FROM biz_course WHERE deleted = FALSE) AS courses,
       (SELECT COUNT(*) FROM biz_lecturer WHERE deleted = FALSE) AS lecturers,
       (SELECT COUNT(*) FROM biz_training_plan WHERE deleted = FALSE) AS plans,
       (SELECT COUNT(*) FROM biz_training_session WHERE deleted = FALSE) AS sessions,
       (SELECT COUNT(*) FROM biz_case WHERE deleted = FALSE) AS cases;
