-- =============================================================================
-- 阶段 5 性能造数（P1～P6）。只在跑导出计时时用，日常演示不要执行。
-- 日常请用 seed.ps1（每模块 20 条）。本脚本会造 1 万门课，总看板红灯会被停滞规则打满。
--
-- 目标：课程 1 万、签到 2 万、浏览 10 万。前缀 PERF-，可反复执行。
--
-- 课程造 1 万门而不是真实量级的 200 门，唯一原因是 P6 要求「Excel 导出 10000 行 ≤30 秒」——
-- 不造够行数，P6 就只能测个 1000 行的导出，等于没测。其余对象仍按 16.1.1a／C14 的真实量级。
-- =============================================================================

BEGIN;

DELETE FROM dtl_case_view WHERE case_id IN (SELECT id FROM biz_case WHERE case_no LIKE 'PERF-%');
DELETE FROM dtl_attendance WHERE session_id IN (
    SELECT id FROM biz_training_session WHERE session_no LIKE 'PERF-%');
DELETE FROM dtl_session_attendee WHERE session_id IN (
    SELECT id FROM biz_training_session WHERE session_no LIKE 'PERF-%');
DELETE FROM biz_training_session WHERE session_no LIKE 'PERF-%';
DELETE FROM biz_training_plan WHERE plan_no LIKE 'PERF-%';
DELETE FROM biz_case WHERE case_no LIKE 'PERF-%';
DELETE FROM biz_course WHERE course_no LIKE 'PERF-%';
DELETE FROM org_employee WHERE employee_no LIKE 'PERF-E%';

-- 2 万临时人员（签到 UNIQUE(session_id, employee_no) 需要足够工号）
INSERT INTO org_employee (employee_no, employee_name, dept_name, position, email,
                          person_type, person_state, created_by, created_at, updated_at)
SELECT
    'PERF-E' || LPAD(n::text, 5, '0'),
    '性能人员' || n,
    '培训',
    '专员',
    'perf' || n || '@example.com',
    '学员',
    '在职',
    'operator',
    NOW(),
    NOW()
FROM generate_series(1, 20000) AS n;

-- P1／P6：1 万门课程
INSERT INTO biz_course (
    course_no, course_name, review_track, domain_code, owner_no,
    initiated_date, expect_publish_date, validity_period,
    main_state, publish_state,
    created_by, created_at, updated_at, last_state_changed_at, version, deleted)
SELECT
    'PERF-KC' || LPAD(n::text, 5, '0'),
    '性能课程-' || n,
    '内部端到端课程',
    'AI_DEMAND',
    'E0001',
    CURRENT_DATE - 60,
    CURRENT_DATE + ((n % 60)),
    '12 个月',
    CASE WHEN n % 10 = 0 THEN '发布' ELSE '立项' END,
    CASE WHEN n % 10 = 0 THEN '已发布' ELSE NULL END,
    'operator',
    NOW(),
    NOW(),
    NOW() - ((n % 20) || ' days')::interval,
    0,
    FALSE
FROM generate_series(1, 10000) AS n;

-- 培训计划 + 场次（复用 seed 讲师）
INSERT INTO biz_training_plan (
    plan_no, plan_name, course_id, owner_no, target_scope,
    plan_start_date, plan_end_date, plan_state,
    created_by, created_at, updated_at, last_state_changed_at, deleted)
SELECT
    'PERF-JH0001',
    '性能培训计划',
    c.id,
    'E0001',
    '全员',
    CURRENT_DATE - 30,
    CURRENT_DATE + 30,
    '执行中',
    'operator',
    NOW(),
    NOW(),
    NOW(),
    FALSE
FROM biz_course c
WHERE c.course_no = 'PERF-KC00001';

INSERT INTO biz_training_session (
    session_no, plan_id, session_name, course_id, lecturer_id,
    training_date, start_time, end_time, duration_hours,
    training_form, venue, student_scope, plan_attendee_count,
    session_state, created_by, created_at, updated_at, last_state_changed_at, deleted)
SELECT
    'PERF-JH0001-01',
    p.id,
    '性能场次',
    c.id,
    l.id,
    CURRENT_DATE - 7,
    '09:00',
    '12:00',
    3.0,
    '线下',
    '性能教室',
    '全员',
    20000,
    '已结束',
    'operator',
    NOW(),
    NOW(),
    NOW(),
    FALSE
FROM biz_training_plan p
JOIN biz_course c ON c.course_no = 'PERF-KC00001'
JOIN biz_lecturer l ON l.lecturer_no = 'JS2026070001'
WHERE p.plan_no = 'PERF-JH0001';

-- 2 万签到
INSERT INTO dtl_attendance (
    session_id, employee_no, employee_name_snapshot, attend_status,
    created_by, created_at, updated_at, deleted)
SELECT
    s.id,
    e.employee_no,
    e.employee_name,
    '已签到',
    'operator',
    NOW(),
    NOW(),
    FALSE
FROM biz_training_session s
CROSS JOIN org_employee e
WHERE s.session_no = 'PERF-JH0001-01'
  AND e.employee_no LIKE 'PERF-E%';

-- 案例（course_id 空，避免 uk_case_course）+ 10 万浏览
INSERT INTO biz_case (
    case_no, case_name, contributing_org, domain_codes, owner_no,
    case_state, expect_publish_date, published_at,
    created_by, created_at, updated_at, last_state_changed_at, version, deleted)
VALUES (
    'PERF-AL0001',
    '性能案例',
    'AI学院',
    '["AI_DEMAND"]'::jsonb,
    'E0001',
    '已上架',
    CURRENT_DATE + 10,
    NOW(),
    'operator',
    NOW(),
    NOW(),
    NOW(),
    0,
    FALSE);

-- 浏览明细不记人：一期只有两个共享账号，account_type 就是全部可追溯的粒度（AC1）
INSERT INTO dtl_case_view (case_id, account_type, viewed_at, duration_seconds)
SELECT
    c.id,
    'USER',
    NOW() - ((n % 90) || ' days')::interval,
    (n % 1800)
FROM biz_case c
CROSS JOIN generate_series(1, 100000) AS n
WHERE c.case_no = 'PERF-AL0001';

COMMIT;

SELECT 'perf seed ok' AS status,
       (SELECT COUNT(*) FROM biz_course WHERE course_no LIKE 'PERF-%') AS courses,
       (SELECT COUNT(*) FROM dtl_attendance a
         JOIN biz_training_session s ON s.id = a.session_id
        WHERE s.session_no LIKE 'PERF-%' AND a.deleted = FALSE) AS attendance,
       (SELECT COUNT(*) FROM dtl_case_view v
         JOIN biz_case c ON c.id = v.case_id
        WHERE c.case_no LIKE 'PERF-%') AS views;
