-- 课程详情「立项」页：规格 13 项。立项单号系统生成；结论与立项状态走字典，不新建状态机。
-- 不改五个状态列。目标受众复用已有 target_audience。

ALTER TABLE dict_item DROP CONSTRAINT ck_dict_type;
ALTER TABLE dict_item
    ADD CONSTRAINT ck_dict_type CHECK (dict_type IN (
        '作战单元', '课程分类', '课程立项状态', '课程立项评审结论'));

COMMENT ON COLUMN dict_item.dict_type IS
    '字典类型。自检清单走 cfg_selfcheck_item；课程立项结论／状态与课程分类一样可后续扩展';

ALTER TABLE biz_course
    ADD COLUMN IF NOT EXISTS initiation_no VARCHAR(32),
    ADD COLUMN IF NOT EXISTS business_pain TEXT,
    ADD COLUMN IF NOT EXISTS course_goal TEXT,
    ADD COLUMN IF NOT EXISTS course_value TEXT,
    ADD COLUMN IF NOT EXISTS outline_summary TEXT,
    ADD COLUMN IF NOT EXISTS estimate_dev_days NUMERIC(6, 1),
    ADD COLUMN IF NOT EXISTS review_judges TEXT,
    ADD COLUMN IF NOT EXISTS initiation_review_date DATE,
    ADD COLUMN IF NOT EXISTS initiation_review_conclusion VARCHAR(64),
    ADD COLUMN IF NOT EXISTS initiation_review_opinion TEXT,
    ADD COLUMN IF NOT EXISTS initiation_status VARCHAR(64);

UPDATE biz_course
   SET initiation_no = 'LI'
        || to_char(COALESCE(initiated_date, (created_at AT TIME ZONE 'Asia/Shanghai')::date), 'YYYYMM')
        || lpad(id::TEXT, 6, '0')
 WHERE initiation_no IS NULL;

ALTER TABLE biz_course
    ALTER COLUMN initiation_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_course_initiation_no
    ON biz_course (initiation_no);

COMMENT ON COLUMN biz_course.initiation_no IS '立项单号，LI + 年月 + 流水。与课程ID独立';
COMMENT ON COLUMN biz_course.business_pain IS '业务背景与痛点';
COMMENT ON COLUMN biz_course.course_goal IS '课程目标';
COMMENT ON COLUMN biz_course.course_value IS '课程价值（ROI）';
COMMENT ON COLUMN biz_course.outline_summary IS '初步大纲摘要';
COMMENT ON COLUMN biz_course.estimate_dev_days IS '预估开发工时，单位天';
COMMENT ON COLUMN biz_course.review_judges IS '立项评审责任人／评委姓名，手工录入，可多人';
COMMENT ON COLUMN biz_course.initiation_review_date IS '立项评审时间，纯日期';
COMMENT ON COLUMN biz_course.initiation_review_conclusion IS '立项评审结论，取字典课程立项评审结论的编码';
COMMENT ON COLUMN biz_course.initiation_review_opinion IS '立项评审意见';
COMMENT ON COLUMN biz_course.initiation_status IS '立项状态，取字典课程立项状态的编码。不是课程主状态';
