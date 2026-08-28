-- 详情「关联课程」页签：外链。文档附件仍走 sys_attachment_ref（ref_field = course_docs）。

ALTER TABLE biz_demand
    ADD COLUMN IF NOT EXISTS course_link VARCHAR(2000);

COMMENT ON COLUMN biz_demand.course_link IS '关联课程外链（http/https），可跳转；课程库 N:N 关联仍走 rel_demand_course';
