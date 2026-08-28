-- 阶段 4：催办台账补需求 8.5 快照列（写入时定格，不 JOIN 取当前值）。
-- 基表见 V1_001 dtl_escalation_record（开发 5.8.3）。

ALTER TABLE dtl_escalation_record
    ADD COLUMN process_node VARCHAR(64),
    ADD COLUMN light        VARCHAR(16),
    ADD COLUMN source       VARCHAR(32) NOT NULL DEFAULT '运营手动',
    ADD COLUMN content      VARCHAR(2000);

ALTER TABLE dtl_escalation_record
    ADD CONSTRAINT ck_escalation_source
        CHECK (source IN ('系统生成清单', '运营手动'));

ALTER TABLE dtl_escalation_record
    ADD CONSTRAINT ck_escalation_light
        CHECK (light IS NULL OR light IN ('BLUE', 'YELLOW', 'RED', 'NONE'));

COMMENT ON COLUMN dtl_escalation_record.process_node IS '催办时对象的当前状态快照（需求 8.5 处理节点）';
COMMENT ON COLUMN dtl_escalation_record.light IS '催办时灯色 API 码快照（需求 8.5）';
COMMENT ON COLUMN dtl_escalation_record.source IS '催办来源：系统生成清单 / 运营手动（需求 8.5）';
COMMENT ON COLUMN dtl_escalation_record.content IS '催办文案快照；系统按模板生成，运营可改后写入（需求 13.5.1）';
