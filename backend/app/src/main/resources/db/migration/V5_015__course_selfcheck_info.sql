-- 课程详情「自检」页：规格基础信息 + 8 项是／否清单。
-- 不改五个状态列。清单答案不进 cfg_selfcheck_item，避免改官方 14 条题库的完成度分母。

ALTER TABLE dict_item DROP CONSTRAINT ck_dict_type;
ALTER TABLE dict_item
    ADD CONSTRAINT ck_dict_type CHECK (dict_type IN (
        '作战单元', '课程分类',
        '课程立项状态', '课程立项评审结论',
        '课程自检记录状态', '课程自检结论'));

ALTER TABLE biz_course
    ADD COLUMN IF NOT EXISTS selfcheck_checker_no VARCHAR(32),
    ADD COLUMN IF NOT EXISTS selfcheck_completed_date DATE,
    ADD COLUMN IF NOT EXISTS selfcheck_conclusion VARCHAR(64),
    ADD COLUMN IF NOT EXISTS selfcheck_record_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS submit_expert_review VARCHAR(8),
    ADD COLUMN IF NOT EXISTS selfcheck_spec_answers JSONB;

COMMENT ON COLUMN biz_course.selfcheck_checker_no IS '自检人，手工选人员，规格要求为课程负责人本人';
COMMENT ON COLUMN biz_course.selfcheck_completed_date IS '自检完成时间，纯日期';
COMMENT ON COLUMN biz_course.selfcheck_conclusion IS '自检总体结论，取字典课程自检结论的编码';
COMMENT ON COLUMN biz_course.selfcheck_record_status IS '自检页手选记录状态，取字典编码。不是课程自检子状态';
COMMENT ON COLUMN biz_course.submit_expert_review IS '是否提交专家评审，是／否。选是后由前端走提交评审动作';
COMMENT ON COLUMN biz_course.selfcheck_spec_answers IS '规格 8 项是否符合要求，JSON 对象，值是是／否';
