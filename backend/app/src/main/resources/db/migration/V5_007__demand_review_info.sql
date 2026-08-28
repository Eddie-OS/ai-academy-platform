-- 需求详情「评审信息」：评审意见／结论不限字数；评审备注与登记表单 remark 分开。
-- 历史轮次 dtl_demand_review.remark 只随新一轮 INSERT，禁止 UPDATE 旧行。

ALTER TABLE biz_demand
    ALTER COLUMN review_conclusion TYPE TEXT,
    ALTER COLUMN review_opinion TYPE TEXT,
    ADD COLUMN IF NOT EXISTS review_remark TEXT;

COMMENT ON COLUMN biz_demand.review_remark IS
    '评审备注（专家会补充说明）。与登记表单 remark 独立，改评审备注不影响登记备注';

ALTER TABLE dtl_demand_review
    ALTER COLUMN review_conclusion TYPE TEXT,
    ALTER COLUMN review_opinion TYPE TEXT,
    ADD COLUMN IF NOT EXISTS remark TEXT;

COMMENT ON COLUMN dtl_demand_review.remark IS
    '该轮评审备注。历史行不改，新一轮才 INSERT';
