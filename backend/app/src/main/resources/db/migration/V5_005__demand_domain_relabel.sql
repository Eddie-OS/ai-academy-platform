-- =============================================================================
-- V5_005__demand_domain_relabel.sql　需求所属领域改现场口径（D-21）
--
-- 历史造数与作战单元编码（AI_DEMAND／COURSE／…）改成零售／GTM／电商／MKT／服务／渠道／政企。
-- 演示批 XQ202607xxxx 再按流水摊到七类，态势图才能看到完整分类。
-- =============================================================================

UPDATE biz_demand SET domain_code = CASE domain_code
        WHEN 'AI_DEMAND' THEN 'GTM'
        WHEN 'COURSE' THEN '零售'
        WHEN 'TRAINER' THEN '渠道'
        WHEN 'LECTURER' THEN '渠道'
        WHEN 'TRAINING' THEN '服务'
        WHEN 'CASE' THEN '政企'
        WHEN '课程内容' THEN '零售'
        WHEN '学员运营' THEN 'GTM'
        WHEN '教学服务' THEN '电商'
        WHEN '讲师运营' THEN '服务'
        WHEN '学习体验' THEN '渠道'
        WHEN '数据分析' THEN '政企'
        WHEN '案例管理' THEN '政企'
        ELSE domain_code
    END
 WHERE deleted = FALSE
   AND domain_code IN (
        'AI_DEMAND', 'COURSE', 'TRAINER', 'LECTURER', 'TRAINING', 'CASE',
        '课程内容', '学员运营', '教学服务', '讲师运营', '学习体验', '数据分析', '案例管理');

UPDATE biz_demand
   SET domain_code = (ARRAY['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'])[
           1 + ((substring(demand_no from 9)::INT - 1) % 7)]
 WHERE deleted = FALSE
   AND demand_no ~ '^XQ202607\d{4}$';
