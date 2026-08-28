-- 课程立项表单补「来源」「备注」。课程ID 仍由系统生成，这两列只记运营录入的说明。

ALTER TABLE biz_course
    ADD COLUMN IF NOT EXISTS source VARCHAR(200);

ALTER TABLE biz_course
    ADD COLUMN IF NOT EXISTS remark VARCHAR(2000);

COMMENT ON COLUMN biz_course.source IS '课程来源（立项时录入，自由文本）';
COMMENT ON COLUMN biz_course.remark IS '课程备注（立项/编辑时可填）';
