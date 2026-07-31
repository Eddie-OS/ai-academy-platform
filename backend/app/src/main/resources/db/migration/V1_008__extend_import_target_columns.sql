-- =============================================================================
-- V1_008__extend_import_target_columns.sql
--
-- 阶段 1C：补齐两张导入目标表缺的列。
--
-- 这四列在 1B 建表时漏了，是 1C 写导入 Handler 时才暴露的——把模板列逐个对到库列上，
-- 才发现签到模板的 E、F 两列（签到时间、备注）与参训名单的「加入方式」无处落。
-- 规则 DB-3 禁止改已合并的脚本，因此新增本脚本。
--
-- 判断标准是「模板里有这一列，或需求的字段表列了这一列，且有明确的读取方」。
-- 不满足的一律不补：需求 11.5.1／11.5.2 的「所属部门」曾用于部门维度覆盖率指标，
-- 而那个指标随 N18 取消了，但字段表本身在 V1.2 仍保留它并写明「冗余存储的理由不变
-- ——签到记录里存当时的部门可以保证历史数据稳定」，签到页签与名单页签都要展示它，
-- 因此补。注意它是**自由文本部门名**，不是 V1.1 删掉的 dept_code_snapshot（部门编码），
-- 后者随组织架构整体取消，SchemaConventionTest 有断言禁止它复活。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- dtl_attendance　签到记录（需求 11.5.2、14.4 模板 E／F 列）
-- -----------------------------------------------------------------------------
ALTER TABLE dtl_attendance
    ADD COLUMN attend_time      TIMESTAMPTZ,
    ADD COLUMN dept_name_snapshot VARCHAR(50),
    ADD COLUMN remark           VARCHAR(200);

COMMENT ON COLUMN dtl_attendance.attend_time IS '签到时间（需求 11.5.2、模板 E 列）。留空时取场次开始时间（需求 14.4）';
COMMENT ON COLUMN dtl_attendance.dept_name_snapshot IS '签到时的部门名快照，自由文本（N18 之后部门没有编码）。不 JOIN 人员表取当前值';
COMMENT ON COLUMN dtl_attendance.remark IS '备注（模板 F 列），≤200 字';


-- -----------------------------------------------------------------------------
-- dtl_session_attendee　参训名单（需求 11.5.1）
--
-- 加入方式的两个取值来自需求 11.5.1 字段表。它不只是展示字段：签到导入发现名单里没有
-- 这个人时会自动补入（需求 14.4、验收 A8-6），而「这一行是运营指派的还是随签到自动补的」
-- 决定了撤销签到批次时它该不该一起回滚（A8-7）。
--
-- 默认值给「运营指派」：本列之前不存在，已有行只能是手工或名单导入写进去的。
-- -----------------------------------------------------------------------------
ALTER TABLE dtl_session_attendee
    ADD COLUMN dept_name_snapshot VARCHAR(50),
    ADD COLUMN join_source        VARCHAR(32) NOT NULL DEFAULT '运营指派';

ALTER TABLE dtl_session_attendee
    ADD CONSTRAINT ck_session_attendee_join_source
        CHECK (join_source IN ('运营指派', '随签到导入自动加入'));

COMMENT ON COLUMN dtl_session_attendee.dept_name_snapshot IS '参训时的部门名快照，自由文本（需求 11.5.1）';
COMMENT ON COLUMN dtl_session_attendee.join_source IS '加入方式（需求 11.5.1）。「随签到导入自动加入」的行由签到导入创建，撤销签到批次时一并回滚（验收 A8-7）';
