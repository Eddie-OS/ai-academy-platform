-- =============================================================================
-- V5_006__demand_demo_register_fields.sql　演示需求补齐登记表单字段
--
-- seed-demo 早期只写了描述一行。详情「基本信息」与新建表单对齐后，
-- 已入库的 XQ202607* 若业务背景／ROI／备注为空会整格空白。
-- =============================================================================

UPDATE biz_demand
SET owner_names = COALESCE(NULLIF(btrim(owner_names), ''), owner_no)
WHERE deleted = FALSE
  AND demand_no LIKE 'XQ202607%'
  AND (owner_names IS NULL OR btrim(owner_names) = '');

UPDATE biz_demand
SET business_background = '【造数】业务背景：对应一线场景与痛点。登记时需写清当前痛点、用户或业务机会。'
WHERE deleted = FALSE
  AND demand_no LIKE 'XQ202607%'
  AND (business_background IS NULL OR btrim(business_background) = '');

UPDATE biz_demand
SET roi_analysis = '【造数】定性：支撑运营记录；量化：一期不做自动测算。'
WHERE deleted = FALSE
  AND demand_no LIKE 'XQ202607%'
  AND (roi_analysis IS NULL OR btrim(roi_analysis) = '');

UPDATE biz_demand
SET remark = '演示造数，字段与登记表单对齐。'
WHERE deleted = FALSE
  AND demand_no LIKE 'XQ202607%'
  AND (remark IS NULL OR btrim(remark) = '');

UPDATE biz_demand
SET description = '【背景】一线登记「' || demand_name || '」时的痛点。' || E'\n'
    || '【目标】完成记录与可视化，不替线下做判断。' || E'\n'
    || '【要求】字段与新建需求表单一致，结论由运营录入。'
WHERE deleted = FALSE
  AND demand_no LIKE 'XQ202607%'
  AND description LIKE '【造数】覆盖状态与灯色%';
