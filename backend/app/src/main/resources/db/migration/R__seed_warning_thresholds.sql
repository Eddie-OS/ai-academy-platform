-- =============================================================================
-- R__seed_warning_thresholds.sql　三色灯阈值初始值（规则 DB-4）
--
-- 需求 13.4.3 的四行，蓝 3 天 / 红 5 天。**这四行不是示例数据**：13.9.2 明确「固定四行，
-- 不可增删」，缺行时对应对象类型的灯色算不出来（TD-4 的 calc_light 要拿阈值当入参）。
--
-- 幂等：ON CONFLICT DO NOTHING。阈值是运营可维护的，脚本只负责「不存在时插入」，
-- 不覆盖运营在配置中心调过的值——否则每次发版都会把运营的配置改回 3/5。
-- =============================================================================

INSERT INTO cfg_warning_threshold (object_type, blue_days, red_days, created_by)
VALUES ('AI需求', 3, 5, 'system'),
       ('课程', 3, 5, 'system'),
       ('培训计划', 3, 5, 'system'),
       ('案例', 3, 5, 'system')
ON CONFLICT (object_type) DO NOTHING;
