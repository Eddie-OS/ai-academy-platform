package com.aiacademy.aggregate.warning.service;

import com.aiacademy.aggregate.warning.domain.LightColor;
import com.aiacademy.aggregate.warning.domain.WarningDetailItem;
import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.aggregate.warning.domain.WarningObjectKind;
import com.aiacademy.aggregate.warning.domain.WarningSummary;
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
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 三色灯实时计算（V-9 口径；开发 5.4.1）。只读（AR-3）。
 *
 * <p>蓝=正常运行、黄=需要关注、红=逾期或停滞、无=算不出灯。
 * 展示与列表筛选一律走这里／{@code calc_light}；{@code snapshot_warning_light} 仅供变化检测。
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
                kind.table(), kind.expectFinishColumn(), kind.stateColumn(),
                kind.extraScopeColumn(), objectId);
        if (row == null || row.isEmpty()) {
            return WarningLightView.none(objectType, objectId);
        }
        return toView(kind, row, thresholdOf(kind));
    }

    /**
     * 列表装配用：按主键批量算灯色。空 ids 返回空列表。
     */
    @Transactional(readOnly = true)
    public List<WarningLightView> calcMany(String objectType, Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        WarningObjectKind kind = WarningObjectKind.require(objectType);
        WarningThreshold threshold = thresholdOf(kind);
        List<Long> idList = List.copyOf(ids);
        List<WarningLightView> result = new ArrayList<>(idList.size());
        for (Map<String, Object> row : lights.listCandidatesByIds(
                kind.table(), kind.expectFinishColumn(), kind.stateColumn(),
                kind.extraScopeColumn(), idList)) {
            result.add(toView(kind, row, threshold));
        }
        return result;
    }

    /**
     * 快照用：三类对象各自算一遍当前灯色（含终态／退出预警 → NONE）。
     */
    @Transactional(readOnly = true)
    public List<WarningLightView> calcAllForSnapshot() {
        List<WarningLightView> result = new ArrayList<>();
        for (WarningObjectKind kind : WarningObjectKind.values()) {
            WarningThreshold threshold = thresholdOf(kind);
            for (Map<String, Object> row : lights.listCandidates(
                    kind.table(), kind.expectFinishColumn(), kind.stateColumn(),
                    kind.extraScopeColumn())) {
                result.add(toView(kind, row, threshold));
            }
        }
        return result;
    }

    /**
     * 总看板 C 区：三色计数。退出预警范围的对象不计入任一项（需求 7.5）。
     * V-9：蓝即健康态，{@code healthy} 与 {@code blue} 同值。
     */
    @Transactional(readOnly = true)
    public WarningSummary summarize() {
        long blue = 0;
        long yellow = 0;
        long red = 0;
        for (WarningObjectKind kind : WarningObjectKind.values()) {
            WarningThreshold threshold = thresholdOf(kind);
            for (Map<String, Object> row : lights.listCandidates(
                    kind.table(), kind.expectFinishColumn(), kind.stateColumn(),
                    kind.extraScopeColumn())) {
                String state = (String) row.get("current_state");
                if (outOfWarningScope(kind, state, row)) {
                    continue;
                }
                LocalDate expect = toLocalDate(row.get("expect_finish"));
                OffsetDateTime lastChanged = toOffsetDateTime(row.get("last_state_changed_at"));
                LightColor color = LightColor.fromApi(lights.calcLight(
                        expect, lastChanged, threshold.blueDays(), threshold.redDays(), false));
                switch (color) {
                    case BLUE -> blue++;
                    case YELLOW -> yellow++;
                    case RED -> red++;
                    case NONE -> { /* 无预计完成：不算健康、不可下钻 */ }
                }
            }
        }
        return new WarningSummary(blue, blue, yellow, red);
    }

    /**
     * 预警明细：仅蓝／黄／红；{@code light} 为空则三色全出。按红→黄→蓝、同色按剩余／停滞天数升序。
     */
    @Transactional(readOnly = true)
    public List<WarningDetailItem> listDetails(String lightFilter, int limit) {
        LightColor filter = lightFilter == null || lightFilter.isBlank()
                ? null : LightColor.fromApi(lightFilter);
        if (filter == LightColor.NONE) {
            return List.of(); // 无灯（算不出）不可下钻；蓝灯为健康态仍可下钻
        }
        List<WarningDetailItem> items = new ArrayList<>();
        for (WarningObjectKind kind : WarningObjectKind.values()) {
            WarningThreshold threshold = thresholdOf(kind);
            for (Map<String, Object> row : lights.listDetailCandidates(
                    kind.table(), kind.expectFinishColumn(), kind.stateColumn(),
                    kind.extraScopeColumn(), kind.nameColumn(), kind.ownerColumn())) {
                String state = (String) row.get("current_state");
                if (outOfWarningScope(kind, state, row)) {
                    continue;
                }
                LocalDate expect = toLocalDate(row.get("expect_finish"));
                OffsetDateTime lastChanged = toOffsetDateTime(row.get("last_state_changed_at"));
                LightColor color = LightColor.fromApi(lights.calcLight(
                        expect, lastChanged, threshold.blueDays(), threshold.redDays(), false));
                if (color == LightColor.NONE) {
                    continue;
                }
                if (filter != null && color != filter) {
                    continue;
                }
                long id = ((Number) row.get("object_id")).longValue();
                String reason = redReason(color, expect, lastChanged, threshold.redDays());
                Integer days = daysOf(color, expect, lastChanged, reason);
                items.add(new WarningDetailItem(
                        kind.objectType(), id,
                        (String) row.get("object_name"),
                        state, (String) row.get("owner_no"), null, expect, lastChanged,
                        color.apiCode(), days, reason));
            }
        }
        items.sort(Comparator
                .comparingInt((WarningDetailItem i) -> lightRank(i.light()))
                .thenComparing(i -> i.lightDays() == null ? Integer.MAX_VALUE : i.lightDays()));
        if (limit > 0 && items.size() > limit) {
            return List.copyOf(items.subList(0, limit));
        }
        return List.copyOf(items);
    }

    private static int lightRank(String light) {
        return switch (LightColor.fromApi(light)) {
            case RED -> 0;
            case YELLOW -> 1;
            case BLUE -> 2;
            case NONE -> 3;
        };
    }

    private WarningLightView toView(WarningObjectKind kind, Map<String, Object> row,
                                    WarningThreshold threshold) {
        long id = ((Number) row.get("object_id")).longValue();
        LocalDate expect = toLocalDate(row.get("expect_finish"));
        OffsetDateTime lastChanged = toOffsetDateTime(row.get("last_state_changed_at"));
        String state = (String) row.get("current_state");
        boolean outOfScope = outOfWarningScope(kind, state, row);

        String light = lights.calcLight(expect, lastChanged,
                threshold.blueDays(), threshold.redDays(), outOfScope);
        LightColor color = LightColor.fromApi(light);
        String reason = outOfScope ? null
                : redReason(color, expect, lastChanged, threshold.redDays());
        return new WarningLightView(kind.objectType(), id, color.apiCode(),
                daysOf(color, expect, lastChanged, reason), reason);
    }

    /** 红灯成因：停滞优先于逾期（与 {@code calc_light} 判定顺序一致）。 */
    static String redReason(LightColor color, LocalDate expect, OffsetDateTime lastChanged,
                            int redThreshold) {
        if (color != LightColor.RED) {
            return null;
        }
        LocalDate today = LocalDate.now();
        if (lastChanged != null) {
            LocalDate changed = lastChanged.atZoneSameInstant(ZoneId.systemDefault()).toLocalDate();
            if ((today.toEpochDay() - changed.toEpochDay()) > redThreshold) {
                return "状态停滞";
            }
        }
        if (expect != null && today.isAfter(expect)) {
            return "已逾期";
        }
        return "状态停滞";
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
        return outOfWarningScope(kind, currentState, Map.of());
    }

    boolean outOfWarningScope(WarningObjectKind kind, String currentState, Map<String, Object> row) {
        // 分流出口「需求驳回」没有交付标记，但仍退出预警（现场口径 D-20）
        if (kind == WarningObjectKind.DEMAND && "需求驳回".equals(row.get("extra_state"))) {
            return true;
        }
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

    static Integer daysOf(LightColor color, LocalDate expect, OffsetDateTime lastChanged,
                          String redReason) {
        LocalDate today = LocalDate.now();
        return switch (color) {
            case BLUE, YELLOW -> expect == null ? null
                    : (int) (expect.toEpochDay() - today.toEpochDay());
            case RED -> {
                if ("已逾期".equals(redReason)) {
                    yield expect == null ? null
                            : (int) (today.toEpochDay() - expect.toEpochDay());
                }
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
