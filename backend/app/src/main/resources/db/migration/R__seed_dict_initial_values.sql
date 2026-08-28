-- =============================================================================
-- R__seed_dict_initial_values.sql　字典初始值（规则 DB-4：初始数据用 R__ 可重复脚本装载）
--
-- 作战单元字典是**总看板与五个驾驶舱的分组维度，缺了首页无法分组**（需求 13.9.3、C16-a），
-- 因此它不是「示例数据」，而是系统跑起来就必须存在的基础配置——造数脚本（scripts/seed）
-- 是可选的，这份不是。
--
-- 五个值取自需求 13.9.3 的初始值表，逐字一致。**不得把它硬编码进代码**（需求 13.9.3 明确
-- 字典允许后续扩展，例如新增「工具平台」「组织推广」）：讲师导入的「擅长领域」校验查的就是
-- 这张表，写成 Java 枚举会让运营在配置中心新增的作战单元被判成非法值。
--
-- 幂等：ON CONFLICT DO NOTHING。名称与排序号是运营可维护的（规则 DC2：编码不可改、名称可改），
-- 因此这里只负责「不存在时插入」，不覆盖运营改过的值。
-- =============================================================================

INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('作战单元', 'AI_DEMAND', 'AI需求', 1, TRUE, 'system'),
       ('作战单元', 'COURSE', '课程', 2, TRUE, 'system'),
       ('作战单元', 'TRAINER', '讲师', 3, TRUE, 'system'),
       ('作战单元', 'TRAINING', '培训', 4, TRUE, 'system'),
       ('作战单元', 'CASE', '案例', 5, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

-- 课程类型（课程工作台列表/立项表单）。编码即展示名，运营可在配置中心改名称。
INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程分类', 'INDIVIDUAL', '个人', 1, TRUE, 'system'),
       ('课程分类', 'ORG', '组织', 2, TRUE, 'system'),
       ('课程分类', 'MANAGEMENT', '管理', 3, TRUE, 'system'),
       ('课程分类', 'PROCESS', '流程', 4, TRUE, 'system'),
       ('课程分类', 'OFFICE', '办公效率', 5, TRUE, 'system'),
       ('课程分类', 'OTHER', '其他', 6, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

-- 课程详情「立项」：结论与立项状态。编码入库，名称给下拉。不写进状态机。
INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程立项状态', 'PENDING', '待立项', 1, TRUE, 'system'),
       ('课程立项状态', 'IN_PROGRESS', '立项中', 2, TRUE, 'system'),
       ('课程立项状态', 'DONE', '已立项', 3, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程立项评审结论', 'PASS', '通过', 1, TRUE, 'system'),
       ('课程立项评审结论', 'FAIL', '不通过', 2, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

-- 课程详情「自检」：记录状态与总体结论。编码入库，名称给下拉。不写进状态机。
INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程自检记录状态', 'PENDING', '待自检', 1, TRUE, 'system'),
       ('课程自检记录状态', 'IN_PROGRESS', '自检中', 2, TRUE, 'system'),
       ('课程自检记录状态', 'DONE', '自检完成', 3, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程自检结论', 'PASS', '自检通过', 1, TRUE, 'system'),
       ('课程自检结论', 'FAIL', '自检不通过', 2, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

-- 课程详情「评审」：阶段、台账状态、初审结论。编码入库，名称给下拉。不写进状态机。
INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程评审阶段', 'PENDING_PRELIM', '待初评', 1, TRUE, 'system'),
       ('课程评审阶段', 'IN_PRELIM', '初评中', 2, TRUE, 'system'),
       ('课程评审阶段', 'PENDING_MEETING', '待上会', 3, TRUE, 'system'),
       ('课程评审阶段', 'IN_MEETING', '上会中', 4, TRUE, 'system'),
       ('课程评审阶段', 'OPTIMIZING', '课程优化', 5, TRUE, 'system'),
       ('课程评审阶段', 'IN_REREVIEW', '复评中', 6, TRUE, 'system'),
       ('课程评审阶段', 'DONE', '评审完成', 7, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程评审台账状态', 'PENDING', '待评审', 1, TRUE, 'system'),
       ('课程评审台账状态', 'IN_PROGRESS', '评审中', 2, TRUE, 'system'),
       ('课程评审台账状态', 'DONE', '评审完成', 3, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('初步评审结论', 'PASS', '初审通过', 1, TRUE, 'system'),
       ('初步评审结论', 'FAIL', '初审不通过', 2, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

-- 上会最终结论。图里第三项是「不通过·结束」，不是官方「不通过·关闭课程开发」。
INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('上会最终结论', 'PASS', '通过', 1, TRUE, 'system'),
       ('上会最终结论', 'REJECT_REVISE', '不通过·修改后重新评审', 2, TRUE, 'system'),
       ('上会最终结论', 'REJECT_END', '不通过·结束', 3, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

-- 课程详情「试讲」：阶段、台账状态、形式、验收结果。编码入库，名称给下拉。不写进状态机。
INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程试讲阶段', 'PENDING_SCHEDULE', '待排期', 1, TRUE, 'system'),
       ('课程试讲阶段', 'SCHEDULED', '已排期', 2, TRUE, 'system'),
       ('课程试讲阶段', 'DONE', '试讲完成', 3, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程试讲台账状态', 'PENDING', '待试讲', 1, TRUE, 'system'),
       ('课程试讲台账状态', 'IN_PROGRESS', '试讲中', 2, TRUE, 'system'),
       ('课程试讲台账状态', 'DONE', '试讲完成', 3, TRUE, 'system'),
       ('课程试讲台账状态', 'PUBLISHED', '课程发布', 4, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('课程试讲形式', 'OFFLINE', '线下试讲', 1, TRUE, 'system'),
       ('课程试讲形式', 'LIVE', '线上直播试讲', 2, TRUE, 'system'),
       ('课程试讲形式', 'RECORDED', '录播试讲', 3, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;

INSERT INTO dict_item (dict_type, item_code, item_name, seq_no, enabled, created_by)
VALUES ('试讲验收结果', 'PASS', '试讲通过', 1, TRUE, 'system'),
       ('试讲验收结果', 'FAIL', '试讲不通过', 2, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;
