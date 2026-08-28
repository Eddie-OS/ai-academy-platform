-- 课程详情「试讲」页：基础信息 + 排期 + 反馈 + 结论台账。
-- 不改五个状态列。官方试讲记录仍在 dtl_course_trial，结论仍走录入结论接口。

ALTER TABLE dict_item DROP CONSTRAINT ck_dict_type;
ALTER TABLE dict_item
    ADD CONSTRAINT ck_dict_type CHECK (dict_type IN (
        '作战单元', '课程分类',
        '课程立项状态', '课程立项评审结论',
        '课程自检记录状态', '课程自检结论',
        '课程评审阶段', '课程评审台账状态', '初步评审结论',
        '上会最终结论',
        '课程试讲阶段', '课程试讲台账状态', '课程试讲形式', '试讲验收结果'));

ALTER TABLE biz_course
    ADD COLUMN IF NOT EXISTS trial_lecturer_no VARCHAR(32),
    ADD COLUMN IF NOT EXISTS trial_current_phase VARCHAR(64),
    ADD COLUMN IF NOT EXISTS trial_ledger_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS trial_round_label VARCHAR(64),
    ADD COLUMN IF NOT EXISTS trial_scheduled_date DATE,
    ADD COLUMN IF NOT EXISTS trial_audience_group VARCHAR(200),
    ADD COLUMN IF NOT EXISTS trial_audience_count VARCHAR(32),
    ADD COLUMN IF NOT EXISTS trial_hours NUMERIC(6, 1),
    ADD COLUMN IF NOT EXISTS trial_format VARCHAR(64),
    ADD COLUMN IF NOT EXISTS trial_satisfaction TEXT,
    ADD COLUMN IF NOT EXISTS trial_optimize_advice TEXT,
    ADD COLUMN IF NOT EXISTS trial_acceptance_result VARCHAR(64),
    ADD COLUMN IF NOT EXISTS trial_ready_to_publish VARCHAR(8),
    ADD COLUMN IF NOT EXISTS trial_lecturer_qualified VARCHAR(8),
    ADD COLUMN IF NOT EXISTS trial_conclusion_date DATE,
    ADD COLUMN IF NOT EXISTS trial_remark TEXT;

COMMENT ON COLUMN biz_course.trial_lecturer_no IS '试讲页授课讲师工号，手工选人员';
COMMENT ON COLUMN biz_course.trial_current_phase IS '试讲当前阶段，取字典课程试讲阶段。不是试讲子状态';
COMMENT ON COLUMN biz_course.trial_ledger_status IS '试讲页手选台账状态，取字典编码。不是试讲子状态';
COMMENT ON COLUMN biz_course.trial_round_label IS '试讲轮数，第 1～5 轮。不是自动建档的 round_no';
COMMENT ON COLUMN biz_course.trial_scheduled_date IS '试讲预定时间，纯日期';
COMMENT ON COLUMN biz_course.trial_audience_group IS '试讲面向学员群体';
COMMENT ON COLUMN biz_course.trial_audience_count IS '试讲面向学员人数，文本';
COMMENT ON COLUMN biz_course.trial_hours IS '试讲时长，单位小时';
COMMENT ON COLUMN biz_course.trial_format IS '试讲形式，取字典课程试讲形式';
COMMENT ON COLUMN biz_course.trial_satisfaction IS '整体满意度';
COMMENT ON COLUMN biz_course.trial_optimize_advice IS '优化建议';
COMMENT ON COLUMN biz_course.trial_acceptance_result IS '试讲验收结果，取字典试讲验收结果。不是官方试讲结论';
COMMENT ON COLUMN biz_course.trial_ready_to_publish IS '课程是否满足发布要求，是／否。选是后由前端走试讲通过动作';
COMMENT ON COLUMN biz_course.trial_lecturer_qualified IS '讲师试讲是否合格，是／否。只留痕，不写培养状态';
COMMENT ON COLUMN biz_course.trial_conclusion_date IS '试讲结论录入时间，纯日期';
COMMENT ON COLUMN biz_course.trial_remark IS '试讲结论备注';
