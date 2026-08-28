-- 课程详情「开发」页：规格 8 项里需要落库的日期与闭环标记。
-- 课程ID、立项单号、负责人、开发状态复用已有列；课件 PPT 走材料明细，不新建附件列。
-- 不改五个状态列。「是否进入自检」只记录选择，流转仍走状态机。

ALTER TABLE biz_course
    ADD COLUMN IF NOT EXISTS plan_draft_date DATE,
    ADD COLUMN IF NOT EXISTS actual_draft_date DATE,
    ADD COLUMN IF NOT EXISTS enter_selfcheck VARCHAR(8);

COMMENT ON COLUMN biz_course.plan_draft_date IS '计划课件初稿完成时间，纯日期';
COMMENT ON COLUMN biz_course.actual_draft_date IS '实际课件初稿完成时间，纯日期';
COMMENT ON COLUMN biz_course.enter_selfcheck IS '是否进入课程自检环节，是／否。不直接改状态';
