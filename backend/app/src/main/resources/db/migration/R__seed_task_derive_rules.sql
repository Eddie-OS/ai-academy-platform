-- =============================================================================
-- R__seed_task_derive_rules.sql　任务派生规则初始值（规则 DB-4）
--
-- 需求 13.1.2 的 10 条派生规则，逐行对应。消费方（任务自动派生）在阶段 3，本期只把规则
-- 装进配置表并让配置中心可以维护——需求 13.1.2 明确「默认截止天数须支持后台配置」，
-- 而阶段 3 实现派生时如果表是空的，就只能在代码里先硬编码一份，那份硬编码不会再被删掉。
--
-- due_base 两种取值（开发 5.9.1）：
--   CREATE_DATE           截止 = 触发日 + due_offset_days
--   OBJECT_FIELD:<字段>   截止 = 对象上该字段的值本身，due_offset_days 为 NULL
-- 第 2 条（课程开发）是唯一的 OBJECT_FIELD——它取「课程预计发布时间」而不是「立项日 + N 天」。
-- 这个差异最容易被抹平成统一的 N 天，抹平后课程开发任务的截止时间全部算错。
--
-- 第 9、10 条（业务验收、案例审核）是需求 V1.3 补齐的，默认 7 天暂按同类审核任务填写，
-- **业务方尚未确认**（需求 13.1.2 待确认项 23）。阶段 3 实现派生前须取得确认。
--
-- 幂等：ON CONFLICT DO NOTHING，不覆盖运营改过的天数。
-- =============================================================================

INSERT INTO cfg_task_derive_rule (task_type, title_template, owner_source, due_base,
                                  due_offset_days, enabled, created_by)
VALUES ('需求评审', '{对象名称} 待评审', 'OBJECT_OWNER', 'CREATE_DATE', 7, TRUE, 'system'),
       ('课程开发', '{对象名称} 待开发', 'OBJECT_OWNER', 'OBJECT_FIELD:expect_publish_date', NULL, TRUE, 'system'),
       ('课程评审', '{对象名称} 待评审', 'OBJECT_OWNER', 'CREATE_DATE', 7, TRUE, 'system'),
       ('课程优化', '{对象名称} 待修改后重新评审', 'OBJECT_OWNER', 'CREATE_DATE', 14, TRUE, 'system'),
       ('讲师试讲', '{对象名称} 待试讲', 'OBJECT_OWNER', 'CREATE_DATE', 14, TRUE, 'system'),
       ('签到导入', '{对象名称} 待导入签到', 'OBJECT_OWNER', 'CREATE_DATE', 3, TRUE, 'system'),
       ('培训归档', '{对象名称} 待归档', 'OBJECT_OWNER', 'CREATE_DATE', 7, TRUE, 'system'),
       ('案例整理', '{对象名称} 待整理案例', 'OBJECT_OWNER', 'CREATE_DATE', 14, TRUE, 'system'),
       ('业务验收', '{对象名称} 待业务验收', 'OBJECT_OWNER', 'CREATE_DATE', 7, TRUE, 'system'),
       ('案例审核', '{对象名称} 待审核', 'OBJECT_OWNER', 'CREATE_DATE', 7, TRUE, 'system')
ON CONFLICT (task_type) DO NOTHING;
