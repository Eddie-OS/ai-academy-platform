package com.aiacademy.app.application;

import com.aiacademy.aggregate.warning.domain.LightColor;
import com.aiacademy.aggregate.warning.domain.WarningDetailItem;
import com.aiacademy.aggregate.warning.service.WarningLightService;
import com.aiacademy.app.repository.EscalationPendingMapper;
import com.aiacademy.app.repository.EscalationPendingMapper.CaseDimCount;
import com.aiacademy.app.repository.EscalationPendingMapper.CourseDimCount;
import com.aiacademy.app.repository.EscalationPendingMapper.DemandDimCount;
import com.aiacademy.app.repository.EscalationPendingMapper.OverdueTaskRow;
import com.aiacademy.app.repository.EscalationPendingMapper.OwnerRow;
import com.aiacademy.app.repository.EscalationPendingMapper.PreSessionRow;
import com.aiacademy.app.repository.EscalationPendingMapper.TaskDimCount;
import com.aiacademy.app.repository.EscalationPendingMapper.TrainingDimCount;
import com.aiacademy.app.repository.WarningSnapshotMapper;
import com.aiacademy.app.web.dto.EscalationPendingVO;
import com.aiacademy.app.web.dto.EscalationPendingVO.CaseDim;
import com.aiacademy.app.web.dto.EscalationPendingVO.CourseDim;
import com.aiacademy.app.web.dto.EscalationPendingVO.DemandDim;
import com.aiacademy.app.web.dto.EscalationPendingVO.DimensionCounts;
import com.aiacademy.app.web.dto.EscalationPendingVO.OwnerGroup;
import com.aiacademy.app.web.dto.EscalationPendingVO.PendingItem;
import com.aiacademy.app.web.dto.EscalationPendingVO.Summary;
import com.aiacademy.app.web.dto.EscalationPendingVO.TaskDim;
import com.aiacademy.app.web.dto.EscalationPendingVO.TrainingDim;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.platform.dict.domain.WarningThreshold;
import com.aiacademy.platform.dict.service.WarningThresholdService;
import com.aiacademy.platform.escalation.domain.EscalationConfig;
import com.aiacademy.platform.escalation.domain.EscalationCycle;
import com.aiacademy.platform.escalation.domain.EscalationTemplate;
import com.aiacademy.platform.escalation.repository.EscalationRecordMapper.CycleEscalationMark;
import com.aiacademy.platform.escalation.service.EscalationConfigService;
import com.aiacademy.platform.escalation.service.EscalationService;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 待催办清单实时视图（开发 5.8.2）。不算消息、不落清单表。
 */
@Service
public class EscalationPendingApplicationService {

    /**
     * 状态条件一律从状态机取值后作为参数传给 SQL（出口准则 E2-6）。
     *
     * <p>写死在 Mapper 文本里的状态名不会因转换表改名而报错，只会静默地少算一个维度——
     * 而待催办清单少算的后果是「该催的人没出现在清单里」，运营不会发现。
     */
    private static final List<String> TASK_OPEN_STATES =
            List.of(TaskStateMachine.STATE_PENDING, TaskStateMachine.STATE_IN_PROGRESS);

    /** 课程有效期「即将到期」的提前天数（需求 13.5.3 课程维度）。 */
    private static final int VALIDITY_SOON_DAYS = 30;

    private final WarningLightService lights;
    private final WarningSnapshotMapper snapshots;
    private final WarningThresholdService thresholds;
    private final EscalationConfigService configs;
    private final EscalationService escalations;
    private final EscalationPendingMapper pending;
    private final Clock clock;

    public EscalationPendingApplicationService(WarningLightService lights,
                                               WarningSnapshotMapper snapshots,
                                               WarningThresholdService thresholds,
                                               EscalationConfigService configs,
                                               EscalationService escalations,
                                               EscalationPendingMapper pending,
                                               Clock clock) {
        this.lights = lights;
        this.snapshots = snapshots;
        this.thresholds = thresholds;
        this.configs = configs;
        this.escalations = escalations;
        this.pending = pending;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public EscalationPendingVO build() {
        EscalationConfig cfg = configs.get();
        OffsetDateTime cycleStart = EscalationCycle.currentStart(
                clock, cfg.cycleWeekday(), cfg.cycleTime());
        Map<String, CycleEscalationMark> marks = indexMarks(escalations.marksSince(cycleStart));

        List<Candidate> candidates = new ArrayList<>();
        for (WarningDetailItem item : lights.listDetails(null, 0)) {
            boolean changed = lightChanged(item.objectType(), item.objectId(), item.light());
            if (!includeLit(cfg, item.light(), changed)) {
                continue;
            }
            candidates.add(Candidate.fromWarning(item, changed));
        }
        if (cfg.listEnabled()) {
            for (OverdueTaskRow task : pending.overdueTasks(TASK_OPEN_STATES)) {
                candidates.add(Candidate.fromTask(task));
            }
            for (PreSessionRow session : pending.preSessions(
                    cfg.preSessionDays(), TrainingStateMachines.SESSION_PENDING)) {
                candidates.add(Candidate.fromSession(session));
            }
        }

        Map<String, List<Candidate>> byOwner = new LinkedHashMap<>();
        for (Candidate c : candidates) {
            String key = c.ownerNo == null ? "" : c.ownerNo;
            byOwner.computeIfAbsent(key, k -> new ArrayList<>()).add(c);
        }

        List<OwnerGroup> groups = new ArrayList<>();
        long pendingCount = 0;
        long redUnurgedOver7 = 0;
        OffsetDateTime now = OffsetDateTime.now(clock);

        for (Map.Entry<String, List<Candidate>> entry : byOwner.entrySet()) {
            String ownerNo = entry.getKey().isEmpty() ? null : entry.getKey();
            String ownerName = resolveOwnerName(ownerNo);
            List<PendingItem> items = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (Candidate c : entry.getValue()) {
                String dedupe = c.objectType + ":" + c.objectId;
                if (!seen.add(dedupe)) {
                    continue;
                }
                CycleEscalationMark mark = marks.get(markKey(c.objectType, c.objectId, ownerNo));
                boolean urged = mark != null;
                String urgedLabel = null;
                if (urged) {
                    long days = Math.max(0, ChronoUnit.DAYS.between(mark.escalatedAt().toLocalDate(), now.toLocalDate()));
                    urgedLabel = "已催办 · " + days + " 天前";
                } else {
                    pendingCount++;
                    if ("RED".equals(c.light) && c.lightDays != null && c.lightDays >= 7) {
                        redUnurgedOver7++;
                    }
                }
                String content = EscalationTemplate.render(
                        cfg.templateText(), c.objectName, c.currentState, c.lightDays, ownerName);
                items.add(new PendingItem(
                        c.objectType, c.objectId, c.objectName, c.currentState,
                        c.light, c.lightDays, c.lightReason, c.escalateType, content,
                        urged, urgedLabel, c.lightChanged));
            }
            if (items.isEmpty()) {
                continue;
            }
            items.sort(Comparator
                    .comparingInt((PendingItem i) -> lightRank(i.light()))
                    .thenComparing(i -> i.lightDays() == null ? Integer.MAX_VALUE : i.lightDays()));
            groups.add(new OwnerGroup(ownerNo, ownerName, dimensionsOf(ownerNo), items));
        }

        groups.sort(Comparator.comparing(
                g -> g.ownerName() == null ? "" : g.ownerName(), String.CASE_INSENSITIVE_ORDER));

        return new EscalationPendingVO(
                cycleStart.toString(),
                new Summary(pendingCount, escalations.countSince(cycleStart), redUnurgedOver7),
                groups);
    }

    private boolean includeLit(EscalationConfig cfg, String light, boolean changed) {
        if (cfg.listEnabled()) {
            return true;
        }
        // 清单关闭：仅 RM2 灯色变化追加
        return changed && cfg.appendEnabledFor(light);
    }

    private boolean lightChanged(String objectType, long objectId, String currentApi) {
        String previous = snapshots.findLight(objectType, objectId);
        if (previous == null) {
            return true;
        }
        String prevApi = LightColor.fromSnapshot(previous).apiCode();
        return !Objects.equals(prevApi, currentApi);
    }

    private DimensionCounts dimensionsOf(String ownerNo) {
        Map<String, int[]> thr = thresholdDays();
        int[] demandThr = thr.getOrDefault("AI需求", new int[]{3, 5});
        TaskDimCount tasks = pending.taskCounts(ownerNo, TASK_OPEN_STATES);
        DemandDimCount demands = pending.demandCounts(ownerNo, demandThr[0], demandThr[1],
                DemandStateMachines.ACCEPTANCE_PENDING,
                only(DemandStateMachines.deliveryMark().terminalStates()),
                DemandEnums.OUTLET_REJECT);
        CourseDimCount courses = pending.courseCounts(ownerNo,
                CourseStateMachines.MAIN_REVIEW_DECISION,
                CourseStateMachines.TRIAL_PENDING,
                CourseStateMachines.MAIN_OPTIMIZE,
                VALIDITY_SOON_DAYS,
                CourseStateMachines.mainState().terminalStates());
        TrainingDimCount trainings = pending.trainingCounts(ownerNo,
                TrainingStateMachines.SESSION_PENDING,
                TrainingStateMachines.SESSION_FINISHED,
                TrainingStateMachines.session().terminalStates());
        CaseDimCount cases = pending.caseCounts(ownerNo,
                CaseStateMachines.STATE_PENDING_ORGANIZE,
                CaseStateMachines.STATE_ORGANIZING,
                CaseStateMachines.STATE_PENDING_AUDIT,
                CaseStateMachines.STATE_PUBLISHED);
        return new DimensionCounts(
                new TaskDim(tasks.openCount(), tasks.overdueCount()),
                new DemandDim(demands.blueCount(), demands.yellowCount(), demands.redCount(),
                        demands.pendingAcceptance()),
                new CourseDim(courses.pendingReview(), courses.pendingTrial(),
                        courses.pendingOptimize(), courses.validitySoon()),
                new TrainingDim(trainings.pendingStart(), trainings.pendingAttendance(),
                        trainings.pendingArchive()),
                new CaseDim(cases.pendingOrganize(), cases.organizing(), cases.pendingAudit()));
    }

    /** 需求交付标记只有一个终态（「已归档」），三色灯的退出预警判定按它。 */
    private static String only(Set<String> states) {
        if (states.size() != 1) {
            throw new IllegalStateException("需求交付标记应当只有一个终态，实际为：" + states);
        }
        return states.iterator().next();
    }

    private Map<String, int[]> thresholdDays() {
        Map<String, int[]> map = new HashMap<>();
        for (WarningThreshold t : thresholds.list()) {
            map.put(t.objectType(), new int[]{t.blueDays(), t.redDays()});
        }
        return map;
    }

    private String resolveOwnerName(String ownerNo) {
        if (ownerNo == null || ownerNo.isBlank()) {
            return null;
        }
        OwnerRow row = pending.findOwner(ownerNo);
        return row == null ? ownerNo : row.name();
    }

    private static Map<String, CycleEscalationMark> indexMarks(List<CycleEscalationMark> marks) {
        Map<String, CycleEscalationMark> map = new HashMap<>();
        for (CycleEscalationMark m : marks) {
            map.put(markKey(m.objectType(), m.objectId(), m.ownerNo()), m);
        }
        return map;
    }

    private static String markKey(String objectType, long objectId, String ownerNo) {
        return objectType + "|" + objectId + "|" + (ownerNo == null ? "" : ownerNo);
    }

    private static int lightRank(String light) {
        if (light == null) {
            return 3;
        }
        return switch (light) {
            case "RED" -> 0;
            case "YELLOW" -> 1;
            case "BLUE" -> 2;
            default -> 3;
        };
    }

    private static String escalateTypeOf(String light) {
        if (light == null) {
            return "其他";
        }
        return switch (light) {
            case "YELLOW" -> "逾期";
            case "RED" -> "停滞";
            case "BLUE" -> "即将到期";
            default -> "其他";
        };
    }

    private static final class Candidate {
        final String objectType;
        final long objectId;
        final String objectName;
        final String currentState;
        final String ownerNo;
        final String light;
        final Integer lightDays;
        final String lightReason;
        final String escalateType;
        final boolean lightChanged;
        final java.time.LocalDate expectOrDue;

        private Candidate(String objectType, long objectId, String objectName, String currentState,
                          String ownerNo, String light, Integer lightDays, String lightReason,
                          String escalateType, boolean lightChanged, java.time.LocalDate expectOrDue) {
            this.objectType = objectType;
            this.objectId = objectId;
            this.objectName = objectName;
            this.currentState = currentState;
            this.ownerNo = ownerNo;
            this.light = light;
            this.lightDays = lightDays;
            this.lightReason = lightReason;
            this.escalateType = escalateType;
            this.lightChanged = lightChanged;
            this.expectOrDue = expectOrDue;
        }

        static Candidate fromWarning(WarningDetailItem item, boolean changed) {
            return new Candidate(item.objectType(), item.objectId(), item.objectName(),
                    item.currentState(), item.ownerNo(), item.light(), item.lightDays(),
                    item.lightReason(), escalateTypeOf(item.light()), changed, item.expectFinishDate());
        }

        static Candidate fromTask(OverdueTaskRow task) {
            return new Candidate(TaskStateMachine.OBJECT_TYPE, task.objectId(), task.title(),
                    task.taskState(), task.ownerNo(), "YELLOW",
                    task.dueDate() == null ? null
                            : (int) ChronoUnit.DAYS.between(task.dueDate(), java.time.LocalDate.now()),
                    null, "逾期", false, task.dueDate());
        }

        static Candidate fromSession(PreSessionRow session) {
            return new Candidate(TrainingStateMachines.SESSION_OBJECT_TYPE, session.objectId(),
                    session.objectName(), session.currentState(), session.ownerNo(),
                    "BLUE",
                    session.sessionDate() == null ? null
                            : (int) ChronoUnit.DAYS.between(java.time.LocalDate.now(), session.sessionDate()),
                    null, "即将到期", false, session.sessionDate());
        }
    }
}
