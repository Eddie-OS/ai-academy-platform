-- =============================================================================
-- V5_002__warning_scope_drop_case.sql
--
-- 业务改版 V-70：三色灯预警的设立对象由四类减为三类 —— AI需求、课程、培训计划。
-- 案例退出预警范围。
--
-- 需求 7.5 的原文写的是四类（含案例），本脚本先于文档落地，文档修订记在
-- docs/文档待修清单.md 的 V-70 一条。
--
-- 为什么要动数据：`cfg_warning_threshold` 里那行「案例」已经进了每个部署好的库，
-- R__seed_warning_thresholds.sql 是幂等 INSERT，把它从种子里删掉只影响新库，
-- 已有库的那一行会留下来。留着的后果不是算错灯 —— WarningObjectKind 里没有案例了，
-- 谁都不会再读它 —— 而是配置中心的三色灯阈值 Tab 会继续列出「案例」一行，
-- 运营改它、保存成功、什么都没发生。
--
-- 用逻辑删除而不是 DELETE：SEC2 规定全系统逻辑删除，且阈值表参与审计快照
-- （WarningThresholdService.auditSnapshot 按 id 查行），物理删掉会让历史审计日志
-- 查不到对应的配置行。
-- =============================================================================

UPDATE cfg_warning_threshold
   SET deleted    = TRUE,
       updated_at = NOW(),
       updated_by = 'system'
 WHERE object_type = '案例'
   AND deleted = FALSE;
