package com.aiacademy.platform.dict.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.audit.AuditLog;
import com.aiacademy.platform.audit.AuditSnapshotSource;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.dict.domain.WarningThreshold;
import com.aiacademy.platform.dict.repository.WarningThresholdMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 三色灯阈值（需求 13.9.2 Tab 1）。四行固定，只能改两个天数。
 *
 * <p><b>「保存后灯色实时按新阈值重算」（验收点 A3-6）不需要任何额外实现</b>：需求 13.4.4 规定
 * 灯色实时计算、不落库，阶段 3 的灯色 SQL 每次查询都把阈值当入参读进去。这里唯一要守住的是
 * <b>不缓存阈值</b>——一旦为了省一次查询把它缓存在应用里，A3-6 就会退化成「重启后生效」。
 */
@Service
public class WarningThresholdService implements AuditSnapshotSource {

    public static final String OBJECT_TYPE = "WARNING_THRESHOLD";

    private final WarningThresholdMapper thresholds;

    public WarningThresholdService(WarningThresholdMapper thresholds) {
        this.thresholds = thresholds;
    }

    @Transactional(readOnly = true)
    public List<WarningThreshold> list() {
        return thresholds.findAll();
    }

    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.UPDATE)
    public void update(long id, int blueDays, int redDays) {
        WarningThreshold current = thresholds.findById(id);
        if (current == null) {
            throw new NotFoundException("三色灯阈值配置不存在：" + id);
        }
        // 表上有 CHECK 约束兜底，这里先判是为了把 23509 约束冲突换成一句能看懂的话
        if (blueDays < 1 || blueDays > 30) {
            throw new BizException(ErrorCode.PARAM_INVALID, "蓝灯阈值取值范围是 1–30 天（需求 13.9.2）");
        }
        if (redDays < 1 || redDays > 90) {
            throw new BizException(ErrorCode.PARAM_INVALID, "红灯阈值取值范围是 1–90 天（需求 13.9.2）");
        }
        thresholds.update(id, blueDays, redDays, operator());
    }

    @Override
    public Map<String, Object> auditSnapshot(long objectId) {
        WarningThreshold threshold = thresholds.findById(objectId);
        if (threshold == null) {
            return Map.of();
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        // 键里带对象类型：审计日志按 object_id 查得到是哪一行，但人看日志时不该再去查一次配置表
        snapshot.put(threshold.objectType() + "·蓝灯阈值", threshold.blueDays());
        snapshot.put(threshold.objectType() + "·红灯阈值", threshold.redDays());
        return snapshot;
    }

    private String operator() {
        return OperatorContext.current().account().name();
    }
}
