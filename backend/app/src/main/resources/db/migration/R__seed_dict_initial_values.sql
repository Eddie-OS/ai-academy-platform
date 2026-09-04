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

-- -----------------------------------------------------------------------------
-- 课程工作台的 13 类字典（阶段 5 的 V5_013／V5_015～V5_018 逐个放开 ck_dict_type）
--
-- 与作战单元同理，这些都不是示例数据，而是「系统跑起来就必须存在」的基础配置：
-- 立项、评审、自检、试讲四个页面的每一处下拉框都读这张表，而后端会拿提交上来的编码
-- 回查字典，查不到就是 PARAM_INVALID。
--
-- **在补上这一段之前，全新库里 14 个字典类型只有 1 个有数据。**后果是新建课程那一步
-- 就被拒（「「INDIVIDUAL」不在课程分类字典中」），课程工作台四个台账页整体不可用。
-- 而错误信息说的是「这个取值不对」，读的人会去找取值哪里写错了——不会想到字典整个是空的。
--
-- 这 43 行取自现网库的实际配置，逐行导出，不是照需求文档另抄一份。两处与文档不一致：
--
--   1. 课程分类现网是「个人／组织／管理／流程／办公效率／其他」六项，而需求 13.9.3 的
--      V1.2 初始值写的是「通用能力／工具应用／场景实战／管理认知／前沿认知」五项。
--   2. 需求侧没有为立项／评审／自检／试讲那几类字典给出初始值表。
--
-- 以现网为准的理由：这些编码上已经挂着真实业务数据，改编码会让存量行的分类标签失效
-- （规则 DC2：编码不可改、名称可改）。两处不一致已记入 docs/文档待修清单.md，需出修订单。
--
-- 附一个值得记住的事实：正因为这些字典只存在于某台机器的本地库里，8 个课程与需求的
-- 集成测试共 56 例在任何全新库上都是红的，而它们在那台机器上一直是绿的。
-- 「后端全绿」于是变成了一个依赖单台机器历史状态的结论，而不是仓库内容的属性。
INSERT INTO dict_item (dict_type, item_code, item_name, parent_code, seq_no, enabled, created_by)
VALUES
       ('上会最终结论', 'PASS', '通过', NULL, 1, TRUE, 'system'),
       ('上会最终结论', 'REJECT_REVISE', '不通过·修改后重新评审', NULL, 2, TRUE, 'system'),
       ('上会最终结论', 'REJECT_END', '不通过·结束', NULL, 3, TRUE, 'system'),
       ('初步评审结论', 'PASS', '初审通过', NULL, 1, TRUE, 'system'),
       ('初步评审结论', 'FAIL', '初审不通过', NULL, 2, TRUE, 'system'),
       ('试讲验收结果', 'PASS', '试讲通过', NULL, 1, TRUE, 'system'),
       ('试讲验收结果', 'FAIL', '试讲不通过', NULL, 2, TRUE, 'system'),
       ('课程分类', 'INDIVIDUAL', '个人', NULL, 1, TRUE, 'system'),
       ('课程分类', 'ORG', '组织', NULL, 2, TRUE, 'system'),
       ('课程分类', 'MANAGEMENT', '管理', NULL, 3, TRUE, 'system'),
       ('课程分类', 'PROCESS', '流程', NULL, 4, TRUE, 'system'),
       ('课程分类', 'OFFICE', '办公效率', NULL, 5, TRUE, 'system'),
       ('课程分类', 'OTHER', '其他', NULL, 6, TRUE, 'system'),
       ('课程立项状态', 'PENDING', '待立项', NULL, 1, TRUE, 'system'),
       ('课程立项状态', 'IN_PROGRESS', '立项中', NULL, 2, TRUE, 'system'),
       ('课程立项状态', 'DONE', '已立项', NULL, 3, TRUE, 'system'),
       ('课程立项评审结论', 'PASS', '通过', NULL, 1, TRUE, 'system'),
       ('课程立项评审结论', 'FAIL', '不通过', NULL, 2, TRUE, 'system'),
       ('课程自检结论', 'PASS', '自检通过', NULL, 1, TRUE, 'system'),
       ('课程自检结论', 'FAIL', '自检不通过', NULL, 2, TRUE, 'system'),
       ('课程自检记录状态', 'PENDING', '待自检', NULL, 1, TRUE, 'system'),
       ('课程自检记录状态', 'IN_PROGRESS', '自检中', NULL, 2, TRUE, 'system'),
       ('课程自检记录状态', 'DONE', '自检完成', NULL, 3, TRUE, 'system'),
       ('课程评审台账状态', 'PENDING', '待评审', NULL, 1, TRUE, 'system'),
       ('课程评审台账状态', 'IN_PROGRESS', '评审中', NULL, 2, TRUE, 'system'),
       ('课程评审台账状态', 'DONE', '评审完成', NULL, 3, TRUE, 'system'),
       ('课程评审阶段', 'PENDING_PRELIM', '待初评', NULL, 1, TRUE, 'system'),
       ('课程评审阶段', 'IN_PRELIM', '初评中', NULL, 2, TRUE, 'system'),
       ('课程评审阶段', 'PENDING_MEETING', '待上会', NULL, 3, TRUE, 'system'),
       ('课程评审阶段', 'IN_MEETING', '上会中', NULL, 4, TRUE, 'system'),
       ('课程评审阶段', 'OPTIMIZING', '课程优化', NULL, 5, TRUE, 'system'),
       ('课程评审阶段', 'IN_REREVIEW', '复评中', NULL, 6, TRUE, 'system'),
       ('课程评审阶段', 'DONE', '评审完成', NULL, 7, TRUE, 'system'),
       ('课程试讲台账状态', 'PENDING', '待试讲', NULL, 1, TRUE, 'system'),
       ('课程试讲台账状态', 'IN_PROGRESS', '试讲中', NULL, 2, TRUE, 'system'),
       ('课程试讲台账状态', 'DONE', '试讲完成', NULL, 3, TRUE, 'system'),
       ('课程试讲台账状态', 'PUBLISHED', '课程发布', NULL, 4, TRUE, 'system'),
       ('课程试讲形式', 'OFFLINE', '线下试讲', NULL, 1, TRUE, 'system'),
       ('课程试讲形式', 'LIVE', '线上直播试讲', NULL, 2, TRUE, 'system'),
       ('课程试讲形式', 'RECORDED', '录播试讲', NULL, 3, TRUE, 'system'),
       ('课程试讲阶段', 'PENDING_SCHEDULE', '待排期', NULL, 1, TRUE, 'system'),
       ('课程试讲阶段', 'SCHEDULED', '已排期', NULL, 2, TRUE, 'system'),
       ('课程试讲阶段', 'DONE', '试讲完成', NULL, 3, TRUE, 'system')
ON CONFLICT (dict_type, item_code) DO NOTHING;
