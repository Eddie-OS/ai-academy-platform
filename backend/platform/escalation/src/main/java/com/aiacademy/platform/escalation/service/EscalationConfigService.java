package com.aiacademy.platform.escalation.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.audit.AuditLog;
import com.aiacademy.platform.audit.AuditSnapshotSource;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.escalation.domain.EscalationConfig;
import com.aiacademy.platform.escalation.domain.EscalationConfigForm;
import com.aiacademy.platform.escalation.repository.EscalationConfigMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 催办配置（需求 13.9.5）。
 */
@Service
public class EscalationConfigService implements AuditSnapshotSource {

    public static final String OBJECT_TYPE = "ESCALATION_CONFIG";

    private final EscalationConfigMapper configs;

    public EscalationConfigService(EscalationConfigMapper configs) {
        this.configs = configs;
    }

    @Transactional(readOnly = true)
    public EscalationConfig get() {
        EscalationConfig cfg = configs.find();
        if (cfg == null) {
            throw new NotFoundException("催办配置不存在");
        }
        return cfg;
    }

    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.UPDATE)
    public void update(long id, EscalationConfigForm form) {
        if (id != 1L) {
            throw new NotFoundException("催办配置不存在：" + id);
        }
        LocalTime time;
        try {
            time = LocalTime.parse(form.cycleTime());
        } catch (DateTimeParseException ex) {
            throw new BizException(ErrorCode.PARAM_INVALID, "重算时间格式应为 HH:mm");
        }
        int updated = configs.update(
                form.cycleWeekday(), time,
                form.listEnabled(), form.appendBlue(), form.appendYellow(), form.appendRed(),
                form.templateText(), form.minIntervalHours(), form.preSessionDays(),
                OperatorContext.current().account().name());
        if (updated == 0) {
            throw new NotFoundException("催办配置不存在");
        }
    }

    @Override
    public Map<String, Object> auditSnapshot(long objectId) {
        EscalationConfig cfg = configs.find();
        if (cfg == null) {
            return Map.of();
        }
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("周期星期", cfg.cycleWeekday());
        snap.put("周期时间", cfg.cycleTime().toString());
        snap.put("清单启用", cfg.listEnabled());
        snap.put("追加蓝", cfg.appendBlue());
        snap.put("追加黄", cfg.appendYellow());
        snap.put("追加红", cfg.appendRed());
        snap.put("模板", cfg.templateText());
        snap.put("最小间隔小时", cfg.minIntervalHours());
        snap.put("开课前提醒天数", cfg.preSessionDays());
        return snap;
    }
}
