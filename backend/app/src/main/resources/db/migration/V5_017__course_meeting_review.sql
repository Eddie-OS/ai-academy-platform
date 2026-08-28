-- 课程详情「评审」页第三块：上会评审台账。
-- 不改五个状态列。上会最终结论是字典手选，不是官方评审记录结论，不驱动主状态。

ALTER TABLE dict_item DROP CONSTRAINT ck_dict_type;
ALTER TABLE dict_item
    ADD CONSTRAINT ck_dict_type CHECK (dict_type IN (
        '作战单元', '课程分类',
        '课程立项状态', '课程立项评审结论',
        '课程自检记录状态', '课程自检结论',
        '课程评审阶段', '课程评审台账状态', '初步评审结论',
        '上会最终结论'));

ALTER TABLE biz_course
    ADD COLUMN IF NOT EXISTS meeting_round_label VARCHAR(64),
    ADD COLUMN IF NOT EXISTS meeting_reviewers VARCHAR(500),
    ADD COLUMN IF NOT EXISTS meeting_actual_date DATE,
    ADD COLUMN IF NOT EXISTS meeting_conclusion VARCHAR(64),
    ADD COLUMN IF NOT EXISTS meeting_opinion TEXT;

COMMENT ON COLUMN biz_course.meeting_round_label IS '上会评审轮数，第 1～5 轮';
COMMENT ON COLUMN biz_course.meeting_reviewers IS '上会评审人员，评委姓名';
COMMENT ON COLUMN biz_course.meeting_actual_date IS '实际上会时间，纯日期';
COMMENT ON COLUMN biz_course.meeting_conclusion IS '上会最终结论，取字典上会最终结论的编码。不是官方评审记录结论';
COMMENT ON COLUMN biz_course.meeting_opinion IS '上会评审意见，顶层指导意见';
