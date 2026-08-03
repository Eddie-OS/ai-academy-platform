package com.aiacademy.aggregate.warning.service;

import com.aiacademy.aggregate.warning.domain.LightColor;
import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.aggregate.warning.domain.WarningObjectKind;
import com.aiacademy.aggregate.warning.repository.WarningLightMapper;
import com.aiacademy.platform.dict.domain.WarningThreshold;
import com.aiacademy.platform.dict.service.WarningThresholdService;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 三色灯实时计算（需求 13.4、开发 5.4.1）。只读（AR-3）。
 *
 * <p>展示与列表筛选一律走这里／{@code calc_light}；{@code snapshot_warning_light} 仅供变化检测。
 */
@Service
public class WarningLightService {

    private final WarningLightMapper lights;
    private final WarningThresholdService thresholds;
    private final StateMachineRegistry registry;

    public WarningLightService(WarningLightMapper lights,
                               WarningThresholdService thresholds,
                               StateMachineRegistry registry) {
        this.lights = lights;
        this.thresholds = thresholds;
        this.registry = registry;
    }

    @Transactional(readOnly = true)
    public WarningLightView calc(String objectType, long objectId) {
        WarningObjectKind kind = WarningObjectKind.require(objectType);
        Map<String, Object> row = lights.findCandidate(
                kind.table(), kind.expectFinishColumn(), kind.stateColumn(), objectId);
        if (row == null || row.isEmpty()) {
            return WarningLightView.none(objectType, objectId);
        }
        return toView(kind, row, thresholdOf(kind));
    }

    /**
     * 快照用：四类对象各自算一遍当前灯色（含终态／退出预警 → NONE）。
     */
    @Transactional(readOnly = true)
    public List<WarningLightView> calcAllForSnapshot() {
        List<WarningLightView> result = new ArrayList<>();
        for (WarningObjectKind kind : WarningObjectKind.values()) {
            WarningThreshold threshold = thresholdOf(kind);
            for (Map<String, Object> row : lights.listCandidates(
                    kind.table(), kind.expectFinishColumn(), kind.stateColumn())) {
                result.add(toView(kind, row, threshold));
            }
        }
        return result;
    }

    private WarningLightView toView(WarningObjectKind kind, Map<String, Object> row,
                                    WarningThreshold threshold) {
        long id = ((Number) row.get("object_id")).longValue();
        LocalDate expect = toLocalDate(row.get("expect_finish"));
        OffsetDateTime lastChanged = toOffsetDateTime(row.get("last_state_changed_at"));
        String state = (String) row.get("current_state");
        boolean outOfScope = outOfWarningScope(kind, state);

        String light = lights.calcLight(expect, lastChanged,
                threshold.blueDays(), threshold.redDays(), outOfScope);
        LightColor color = LightColor.fromApi(light);
        return new WarningLightView(kind.objectType(), id, color.apiCode(),
                daysOf(color, expect, lastChanged),
                color == LightColor.RED ? "状态停滞" : null);
    }

    private WarningThreshold thresholdOf(WarningObjectKind kind) {
        return thresholds.list().stream()
                .filter(t -> kind.thresholdType().equals(t.objectType()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "缺少三色灯阈值配置：" + kind.thresholdType()));
    }

    /**
     * 退出预警范围 = 转换表标注 {@code exitsWarningScope} 的目标状态 ∪ 终态。
     * 培训计划「已完成」不是终态但退出预警；退回「执行中」后预警恢复。
     */
    boolean outOfWarningScope(WarningObjectKind kind, String currentState) {
        if (currentState == null) {
            return false;
        }
        StateMachineDef machine = registry.requireMachine(kind.objectType(), kind.stateField());
        if (machine.terminalStates().contains(currentState)) {
            return true;
        }
        Set<String> exitStates = new HashSet<>();
        for (Transition t : machine.transitions()) {
            if (t.exitsWarningScope()) {
                exitStates.add(t.to());
            }
        }
        return exitStates.contains(currentState);
    }

    static Integer daysOf(LightColor color, LocalDate expect, OffsetDateTime lastChanged) {
        LocalDate today = LocalDate.now();
        return switch (color) {
            case BLUE -> expect == null ? null : (int) (expect.toEpochDay() - today.toEpochDay());
            case YELLOW -> expect == null ? null : (int) (today.toEpochDay() - expect.toEpochDay());
            case RED -> {
                if (lastChanged == null) {
                    yield null;
                }
                LocalDate changed = lastChanged.atZoneSameInstant(ZoneId.systemDefault()).toLocalDate();
                yield (int) (today.toEpochDay() - changed.toEpochDay());
            }
            case NONE -> null;
        };
    }

    /** Map 结果里 DATE 常是 {@link java.sql.Date}，TIMESTAMPTZ 可能是 Timestamp。 */
    private static LocalDate toLocalDate(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        if (value instanceof java.util.Date utilDate) {
            return utilDate.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        throw new IllegalStateException("无法把 " + value.getClass().getName() + " 转成 LocalDate");
    }

    private static OffsetDateTime toOffsetDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof OffsetDateTime odt) {
            return odt;
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toInstant().atZone(ZoneId.systemDefault()).toOffsetDateTime();
        }
        if (value instanceof java.time.LocalDateTime ldt) {
            return ldt.atZone(ZoneId.systemDefault()).toOffsetDateTime();
        }
        throw new IllegalStateException("无法把 " + value.getClass().getName() + " 转成 OffsetDateTime");
    }
}
