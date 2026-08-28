-- =============================================================================
-- V5_012__cockpit_domain_relabel.sql　课程／讲师／案例领域对齐需求（D-21）
--
-- 需求已在 V5_005 改成零售／GTM／电商／MKT／服务／渠道／政企。
-- 其余三张主表仍是作战单元编码或名称，驾驶舱「领域」列会对不上。
-- =============================================================================

UPDATE biz_course SET domain_code = CASE domain_code
        WHEN 'AI_DEMAND' THEN 'GTM'
        WHEN 'COURSE' THEN '零售'
        WHEN 'TRAINER' THEN '渠道'
        WHEN 'LECTURER' THEN '渠道'
        WHEN 'TRAINING' THEN '服务'
        WHEN 'CASE' THEN '政企'
        WHEN 'AI需求' THEN 'GTM'
        WHEN '课程' THEN '零售'
        WHEN '讲师' THEN '渠道'
        WHEN '培训' THEN '服务'
        WHEN '案例' THEN '政企'
        ELSE domain_code
    END
 WHERE deleted = FALSE
   AND domain_code IN (
        'AI_DEMAND', 'COURSE', 'TRAINER', 'LECTURER', 'TRAINING', 'CASE',
        'AI需求', '课程', '讲师', '培训', '案例');

UPDATE biz_course
   SET domain_code = (ARRAY['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'])[
           1 + ((substring(course_no from 9)::INT - 1) % 7)]
 WHERE deleted = FALSE
   AND course_no ~ '^KC202607\d{4}$';

UPDATE biz_lecturer
   SET expertise_domains = (
           SELECT COALESCE(jsonb_agg(
               CASE value
                   WHEN 'AI_DEMAND' THEN 'GTM'
                   WHEN 'COURSE' THEN '零售'
                   WHEN 'TRAINER' THEN '渠道'
                   WHEN 'LECTURER' THEN '渠道'
                   WHEN 'TRAINING' THEN '服务'
                   WHEN 'CASE' THEN '政企'
                   WHEN 'AI需求' THEN 'GTM'
                   WHEN '课程' THEN '零售'
                   WHEN '讲师' THEN '渠道'
                   WHEN '培训' THEN '服务'
                   WHEN '案例' THEN '政企'
                   ELSE value
               END
           ), '[]'::jsonb)
             FROM jsonb_array_elements_text(expertise_domains) AS value
       )
 WHERE deleted = FALSE
   AND expertise_domains IS NOT NULL;

UPDATE biz_lecturer
   SET expertise_domains = jsonb_build_array(
           (ARRAY['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'])[
               1 + ((substring(lecturer_no from 9)::INT - 1) % 7)])
 WHERE deleted = FALSE
   AND lecturer_no ~ '^JS202607\d{4}$';

UPDATE biz_case
   SET domain_codes = (
           SELECT COALESCE(jsonb_agg(
               CASE value
                   WHEN 'AI_DEMAND' THEN 'GTM'
                   WHEN 'COURSE' THEN '零售'
                   WHEN 'TRAINER' THEN '渠道'
                   WHEN 'LECTURER' THEN '渠道'
                   WHEN 'TRAINING' THEN '服务'
                   WHEN 'CASE' THEN '政企'
                   WHEN 'AI需求' THEN 'GTM'
                   WHEN '课程' THEN '零售'
                   WHEN '讲师' THEN '渠道'
                   WHEN '培训' THEN '服务'
                   WHEN '案例' THEN '政企'
                   ELSE value
               END
           ), '[]'::jsonb)
             FROM jsonb_array_elements_text(domain_codes) AS value
       )
 WHERE deleted = FALSE
   AND domain_codes IS NOT NULL;

UPDATE biz_case
   SET domain_codes = jsonb_build_array(
           (ARRAY['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'])[
               1 + ((substring(case_no from 9)::INT - 1) % 7)])
 WHERE deleted = FALSE
   AND case_no ~ '^AL202607\d{4}$';
