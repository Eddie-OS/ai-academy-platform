-- 课程详情「评审」页：基础信息 + 初步评审台账。
-- 不改五个状态列。官方评审记录仍在 dtl_course_review，结论仍走录入结论接口。

ALTER TABLE dict_item DROP CONSTRAINT ck_dict_type;
ALTER TABLE dict_item
    ADD CONSTRAINT ck_dict_type CHECK (dict_type IN (
        '作战单元', '课程分类',
        '课程立项状态', '课程立项评审结论',
        '课程自检记录状态', '课程自检结论',
        '课程评审阶段', '课程评审台账状态', '初步评审结论'));

ALTER TABLE biz_course
    ADD COLUMN IF NOT EXISTS review_round_label VARCHAR(64),
    ADD COLUMN IF NOT EXISTS review_completed_date DATE,
    ADD COLUMN IF NOT EXISTS review_ledger_phase VARCHAR(64),
    ADD COLUMN IF NOT EXISTS review_ledger_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS enter_trial VARCHAR(8),
    ADD COLUMN IF NOT EXISTS prelim_round_label VARCHAR(64),
    ADD COLUMN IF NOT EXISTS prelim_reviewers VARCHAR(500),
    ADD COLUMN IF NOT EXISTS prelim_review_date DATE,
    ADD COLUMN IF NOT EXISTS prelim_completed_date DATE,
    ADD COLUMN IF NOT EXISTS prelim_conclusion VARCHAR(64),
    ADD COLUMN IF NOT EXISTS prelim_opinion TEXT,
    ADD COLUMN IF NOT EXISTS enter_meeting VARCHAR(8);

COMMENT ON COLUMN biz_course.review_round_label IS '评审页手选轮数，第 1～5 轮。不是自动建档的 round_no';
COMMENT ON COLUMN biz_course.review_completed_date IS '评审完成时间，纯日期';
COMMENT ON COLUMN biz_course.review_ledger_phase IS '当前评审阶段，取字典课程评审阶段的编码。不是状态机';
COMMENT ON COLUMN biz_course.review_ledger_status IS '评审页手选台账状态，取字典编码。不是评审记录状态';
COMMENT ON COLUMN biz_course.enter_trial IS '是否进入试讲环节，是／否。只留痕，不写课程主状态';
COMMENT ON COLUMN biz_course.prelim_round_label IS '初步评审轮数，第 1～5 轮';
COMMENT ON COLUMN biz_course.prelim_reviewers IS '初步评审人员，自由文本';
COMMENT ON COLUMN biz_course.prelim_review_date IS '初步评审时间，纯日期';
COMMENT ON COLUMN biz_course.prelim_completed_date IS '初步评审完成时间，纯日期';
COMMENT ON COLUMN biz_course.prelim_conclusion IS '初步评审结论，取字典初步评审结论的编码';
COMMENT ON COLUMN biz_course.prelim_opinion IS '初步评审意见';
COMMENT ON COLUMN biz_course.enter_meeting IS '是否进入上会评审环节，是／否。一期无上会状态机，只留痕';
