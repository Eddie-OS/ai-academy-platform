package com.aiacademy.aggregate.metrics.service;

import com.aiacademy.aggregate.metrics.domain.CockpitQuantityVO;
import com.aiacademy.aggregate.metrics.domain.QuantitySnapshot;
import com.aiacademy.aggregate.metrics.repository.QuantityMetricsMapper;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 需求 15.1 数量类指标（AR-3 只读）。状态取值从状态机转换表推导后传入 SQL（E2-6）。
 */
@Service
public class QuantityMetricsService {

    /** 分流出口非状态机枚举（需求 5.2／8.3）；不在 StateLiteralGuard 扫描集合内。 */
    private static final String OUTLET_SOLUTION = "用现有工具输出解决方案";
    private static final String OUTLET_DEVELOPMENT = "造工具需求开发";

    /** 讲师枚举（C10：非状态机）。 */
    private static final String POOL_IN = "在池";
    private static final String TRAINING_PENDING = "待培养";
    private static final String TRAINING_IN_PROGRESS = "培养中";
    private static final String TRAINING_READY = "可上岗";

    /** 签到状态（非状态机）。 */
    private static final String ATTEND_PRESENT = "已签到";

    /** 案例精品标注（非状态机字段枚举）。 */
    private static final String QUALITY_MARK_TOP = "精品";

    private final QuantityMetricsMapper mapper;

    public QuantityMetricsService(QuantityMetricsMapper mapper) {
        this.mapper = mapper;
    }

    /**
     * 需求 15.1 全部 28 项。
     *
     * <p>分组指标（#2／#3／#4／#12b）的 value 为 {@code Map<String, Long>}；其余为 {@code long}。
     */
    @Transactional(readOnly = true)
    public QuantitySnapshot all() {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());

        StateMachineDef review = DemandStateMachines.review();
        StateMachineDef development = DemandStateMachines.development();
        StateMachineDef acceptance = DemandStateMachines.acceptance();
        StateMachineDef delivery = DemandStateMachines.deliveryMark();
        StateMachineDef courseMain = CourseStateMachines.mainState();
        StateMachineDef caseSm = CaseStateMachines.caseState();

        List<String> reviewStates = allStates(review);
        List<String> devStates = allStates(development);
        List<String> deliveryMarks = allStates(delivery);

        String acceptancePending = toState(acceptance, DemandStateMachines.ACTION_MARK_DELIVERED);
        String acceptanceReject = toState(acceptance, DemandStateMachines.ACTION_RECORD_ACCEPTANCE_REJECT);

        String courseClosed = toState(courseMain, CourseStateMachines.ACTION_CLOSE_DEVELOPMENT);
        List<String> courseDeveloping = List.of(
                toState(courseMain, CourseStateMachines.ACTION_INITIATE),
                toState(courseMain, "START_DEVELOP"),
                toState(courseMain, "ENTER_SELF_CHECK"),
                toState(courseMain, "SUBMIT_REVIEW"),
                toState(courseMain, "REVIEW_PASS"),
                toState(courseMain, "REVIEW_REJECT_REVISE"));
        List<String> coursePublished = List.of(
                CourseStateMachines.MAIN_PUBLISHED,
                CourseStateMachines.MAIN_PROMOTION,
                CourseStateMachines.MAIN_QUALIFIED_CASE,
                toState(courseMain, "MARK_NOT_QUALIFIED"),
                toState(courseMain, "ARCHIVE_AFTER_CASE_PUBLISHED"));
        List<String> courseQuality = List.of(
                CourseStateMachines.MAIN_QUALIFIED_CASE,
                toState(courseMain, "ARCHIVE_AFTER_CASE_PUBLISHED"));

        String casePublished = toState(caseSm, CaseStateMachines.ACTION_AUDIT_PASS);
        String casePendingAudit = toState(caseSm, "SUBMIT_AUDIT");

        QuantitySnapshot.Builder b = QuantitySnapshot.builder();

        // 需求 15.1 #1～#5b
        b.put("1", mapper.countDemands());
        b.putGroup("2", toLongMap(mapper.countDemandsByReviewState(reviewStates)));
        b.putGroup("3", toLongMap(mapper.countDemandsByDevState(OUTLET_DEVELOPMENT, devStates)));
        b.putGroup("4", toLongMap(mapper.countDemandsByOutlet(List.of(OUTLET_SOLUTION, OUTLET_DEVELOPMENT))));
        b.put("5", mapper.countDemandsWithDeliveryMarks(deliveryMarks));
        b.put("5a", mapper.countDemandsByAcceptanceState(acceptancePending));
        b.put("5b", mapper.countDemandsByAcceptanceState(acceptanceReject));

        // 需求 15.1 #6～#10b
        b.put("6", mapper.countCoursesExcluding(courseClosed));
        b.put("7", mapper.countCoursesInStates(courseDeveloping));
        b.put("8", mapper.countCoursesInStates(coursePublished));
        b.put("9", mapper.countCoursesInStates(courseQuality));
        b.put("10", mapper.countCoursesByState(courseClosed));
        b.put("10a", mapper.countCoursesExpired());
        b.put("10b", mapper.countCoursesExpiringWithinDays(30));

        // 需求 15.1 #11～#12b
        b.put("11", mapper.countLecturersInPool(POOL_IN));
        b.put("12", mapper.countLecturersTrialQualifiedInPool(POOL_IN));
        b.put("12a", mapper.countLecturersByTrainingInPool(POOL_IN, TRAINING_READY));
        b.putGroup("12b", toLongMap(mapper.countLecturersByTrainingStatesInPool(
                POOL_IN, List.of(TRAINING_PENDING, TRAINING_IN_PROGRESS, TRAINING_READY))));

        // 需求 15.1 #13～#16b
        b.put("13", mapper.countPlansOverlapping(monthStart, monthEnd));
        b.put("14", mapper.countSessionsByState(TrainingStateMachines.SESSION_OPENED));
        b.put("15", mapper.countSessionsInMonth(monthStart, monthEnd));
        b.put("16", mapper.countAttendancePresentInMonth(ATTEND_PRESENT, monthStart, monthEnd));
        b.put("16a", mapper.countAttendancePresent(ATTEND_PRESENT));
        b.put("16b", mapper.countDistinctAttendeesPresent(ATTEND_PRESENT));

        // 需求 15.1 #17～#19
        b.put("17", mapper.countCases());
        b.put("18", mapper.countCasesByState(casePublished));
        b.put("18a", mapper.countCasesByState(casePendingAudit));
        b.put("19", mapper.countCasesWithQualityMark(QUALITY_MARK_TOP));

        return b.build();
    }

    /**
     * 驾驶舱一顶部卡：total／pendingReview／reviewing／reviewed／approved／developing／online
     * （不含 cycle）。
     *
     * <p>键名与前端 {@code DEMAND_KPIS} 的卡片 id 一一对应，前端直接按 {@code quantity[kpi.id]}
     * 取值，与课程／培训两个驾驶舱同一取法。
     *
     * <p>原先只吐 total／pending／developing 三个，喂不满 V2 需求驾驶舱冻结的七张卡，于是那边
     * 改成在前端对已加载的列表行 {@code filter().length} 自己数。<b>那条路数的是「当前筛选后、
     * 且已加载的那些行」</b>，而总看板数的是全表，同一个「需求总数」在两个页面必然出现两个值。
     * 补齐这四个键就是为了把前端那套算法删掉。
     *
     * <p>{@code pending} 是 {@code pendingReview} 的同值别名，<b>不要删</b>：总看板需求入口卡
     * （{@code DashboardOverviewApplicationService} 转 {@code ENTRY_LIVE_FIELDS.demands}）与旧版
     * 驾驶舱的 {@code DEMAND_METRICS} 读的都是这个键。
     *
     * <p>七个数字全部取自 {@link #all()} 已经算好的 #2（按评审状态分组）与 #3（按开发状态分组），
     * 没有新增 SQL、没有新口径。注意 #3 按 15.1 定义只统计出口为「造工具需求开发」的需求，
     * 前端那套旧算法不分出口——这也是两边数字会差的一处成因。
     */
    @Transactional(readOnly = true)
    public CockpitQuantityVO forDemands() {
        StateMachineDef review = DemandStateMachines.review();
        StateMachineDef development = DemandStateMachines.development();
        QuantitySnapshot snap = all();
        Map<String, Long> byReview = snap.asGroup("2");
        Map<String, Long> byDev = snap.asGroup("3");

        long pendingReview = byReview.getOrDefault(
                toState(review, DemandStateMachines.ACTION_REGISTER), 0L);

        Map<String, Long> out = new LinkedHashMap<>();
        out.put("total", snap.asLong("1"));
        out.put("pendingReview", pendingReview);
        out.put("pending", pendingReview);
        out.put("reviewing", byReview.getOrDefault(toState(review, "START_REVIEW"), 0L));
        out.put("reviewed", byReview.getOrDefault(
                toState(review, DemandStateMachines.ACTION_RECORD_REVIEW_RESULT), 0L));
        out.put("approved", byDev.getOrDefault(toState(development, "INITIATE"), 0L));
        out.put("developing", byDev.getOrDefault(toState(development, "START_DEVELOP"), 0L));
        out.put("online", byDev.getOrDefault(toState(development, "GO_LIVE"), 0L));
        return CockpitQuantityVO.of(out);
    }

    /**
     * 驾驶舱二顶部卡：total／developing／reviewing／pendingTrial／published／quality
     * （不含 cycle），外加总看板课程卡要的 developed／reviewed（业务改版 V-70）。
     *
     * <p>工作台五张卡与列表同一主状态口径：点卡即按该主状态筛列表，条数必须对得上。
     * 15.1 #6／#7／#8 的管道／集合公式仍在 {@link #all()}，总看板 {@code coursePublished} 继续用 #8。
     * quality／developed／reviewed 也不改。
     */
    @Transactional(readOnly = true)
    public CockpitQuantityVO forCourses() {
        StateMachineDef courseMain = CourseStateMachines.mainState();
        QuantitySnapshot snap = all();
        Map<String, Long> out = new LinkedHashMap<>();
        out.put("total", mapper.countCourses());
        out.put("developing", mapper.countCoursesByState(toState(courseMain, "START_DEVELOP")));
        out.put("reviewing", mapper.countCoursesByState(toState(courseMain, "SUBMIT_REVIEW")));
        out.put("pendingTrial", mapper.countCoursesByState(toState(courseMain, "REVIEW_PASS")));
        out.put("published", mapper.countCoursesByState(CourseStateMachines.MAIN_PUBLISHED));
        out.put("quality", snap.asLong("9"));
        out.put("developed", mapper.countCoursesInStates(coursesDeveloped(courseMain)));
        out.put("reviewed", mapper.countCoursesInStates(coursesReviewed(courseMain)));
        return CockpitQuantityVO.of(out);
    }

    /**
     * 「已开发」= 主状态已离开立项与开发，且没被关闭。
     *
     * <p>没有一个叫「已开发」的状态值（开发子状态只有 待开发／开发中／自检中），所以这是个
     * <b>累计口径</b>：数的是已经走过开发那一段的课程。含「优化」——返工中的课程开发过一遍了。
     * 不含「已关闭」：关闭是终态，早期关闭的课程从没开发完。
     */
    private static List<String> coursesDeveloped(StateMachineDef courseMain) {
        List<String> states = new ArrayList<>(coursesReviewed(courseMain));
        states.add(toState(courseMain, "ENTER_SELF_CHECK"));
        states.add(toState(courseMain, "SUBMIT_REVIEW"));
        states.add(toState(courseMain, "REVIEW_REJECT_REVISE"));
        return List.copyOf(states);
    }

    /**
     * 「已评审」= 已录入过评审结论「通过」，即主状态到过试讲及其之后。
     *
     * <p><b>不含「优化」。</b>优化来自「不通过·修改后重新评审」，评审确实发生过，
     * 但结论是没通过；把它算进「已评审」会让这三档不再单调收窄
     * （已开发 ⊇ 已评审 ⊇ 已发布），而卡上三个数并排读的就是这个漏斗。
     */
    private static List<String> coursesReviewed(StateMachineDef courseMain) {
        return List.of(
                toState(courseMain, "REVIEW_PASS"),
                CourseStateMachines.MAIN_PUBLISHED,
                CourseStateMachines.MAIN_PROMOTION,
                CourseStateMachines.MAIN_QUALIFIED_CASE,
                toState(courseMain, "MARK_NOT_QUALIFIED"),
                toState(courseMain, "ARCHIVE_AFTER_CASE_PUBLISHED"));
    }

    /**
     * 驾驶舱三顶部卡：pool／qualified／attendees（15.3 #5）／active（15.3 #7），
     * 外加总看板讲师卡要的 pendingTrial／cultivating（业务改版 V-70），
     * 以及 V2 讲师页四张卡要的 poolSize／trialQualified／readyToTeach。
     *
     * <p><b>{@code qualified} 是「可上岗」（#12a），不是「试讲合格」。</b>这个键名有歧义但
     * 不能改：总看板讲师入口卡（{@code ENTRY_STAT_LABELS.lecturers} 第三格标签「可上岗」）
     * 与旧版驾驶舱的 {@code LECTURER_METRICS}（标题「可上岗讲师数 · 15.1 12a」）都按可上岗读它。
     * 而 V2 讲师页恰好把自己的卡 id {@code qualified} 用作「试讲合格讲师数」（#12）——
     * 同名不同义，所以那一页不能用 {@code quantity[kpi.id]} 直取，映射表在 LecturerV2Page 里。
     *
     * <p>{@code trialQualified} 才是试讲合格（#12），此前 {@link #all()} 算了但没往外吐，
     * 于是 V2 讲师页只能在前端对已加载的池子自己数——那份池子按 200 条一页取，
     * 讲师超过 200 人时「讲师池人数」会静默停在 200，而总看板显示真实值。
     */
    @Transactional(readOnly = true)
    public CockpitQuantityVO forLecturers() {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        List<String> finished = List.of(
                TrainingStateMachines.SESSION_FINISHED,
                TrainingStateMachines.SESSION_ARCHIVED);

        QuantitySnapshot snap = all();
        Map<String, Long> out = new LinkedHashMap<>();
        out.put("pool", snap.asLong("11"));
        out.put("poolSize", snap.asLong("11"));
        out.put("qualified", snap.asLong("12a"));
        out.put("readyToTeach", snap.asLong("12a"));
        out.put("trialQualified", snap.asLong("12"));
        // 15.3 #5：公式为 COUNT 场次；中文名「人次」见核对表说明
        out.put("attendees", mapper.countTeachingSessionsInMonth(finished, monthStart, monthEnd));
        out.put("active", mapper.countActiveLecturers(finished, today.minusDays(90)));
        /* 「待试讲」数的是课程，不是讲师——见 countCoursesByTrialState 的说明。
           这两个字段同在一节里，一个数课程一个数讲师，别按分节名想当然 */
        out.put("pendingTrial", mapper.countCoursesByTrialState(
                toState(CourseStateMachines.trialSubState(), "MAIN_STATE_ENTERED_TRIAL")));
        out.put("cultivating", snap.asGroup("12b").getOrDefault(TRAINING_IN_PROGRESS, 0L));
        return CockpitQuantityVO.of(out);
    }

    /**
     * 驾驶舱四顶部卡：plans／sessions／attendeesTotal／attendees／archived。
     *
     * <p>四张累计、一张当月（本月参训人次 = 15.1 #16）。{@code *Prev} 是上月末存量
     * （累计）或上月同口径（当月），给前端算月度环比。总看板入口卡仍读
     * {@code sessions}／{@code attendees}。
     */
    @Transactional(readOnly = true)
    public CockpitQuantityVO forTrainings() {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate lastMonthStart = monthStart.minusMonths(1);
        LocalDate lastMonthEnd = monthStart.minusDays(1);
        String archived = TrainingStateMachines.SESSION_ARCHIVED;

        QuantitySnapshot snap = all();
        Map<String, Long> out = new LinkedHashMap<>();
        out.put("plans", mapper.countPlans());
        out.put("plansPrev", mapper.countPlansCreatedBefore(monthStart));
        out.put("sessions", mapper.countSessions());
        out.put("sessionsPrev", mapper.countSessionsCreatedBefore(monthStart));
        out.put("attendeesTotal", snap.asLong("16a"));
        out.put("attendeesTotalPrev", mapper.countAttendancePresentBefore(ATTEND_PRESENT, monthStart));
        out.put("attendees", snap.asLong("16"));
        out.put("attendeesPrev", mapper.countAttendancePresentInMonth(
                ATTEND_PRESENT, lastMonthStart, lastMonthEnd));
        out.put("archived", mapper.countSessionsByState(archived));
        out.put("archivedPrev", mapper.countSessionsByStateChangedBefore(archived, monthStart));
        return CockpitQuantityVO.of(out);
    }

    /** 驾驶舱五顶部卡：total／published／views／likes／comments（15.5 #1～#3 全库）。 */
    @Transactional(readOnly = true)
    public CockpitQuantityVO forCases() {
        QuantitySnapshot snap = all();
        Map<String, Long> out = new LinkedHashMap<>();
        out.put("total", snap.asLong("17"));
        out.put("published", snap.asLong("18"));
        out.put("views", mapper.countCaseViews());
        out.put("likes", mapper.countCaseLikes());
        out.put("comments", mapper.countCaseComments());
        return CockpitQuantityVO.of(out);
    }

    private static List<String> allStates(StateMachineDef def) {
        List<String> states = new ArrayList<>();
        for (Transition t : def.transitions()) {
            if (t.from() != null && !states.contains(t.from())) {
                states.add(t.from());
            }
            if (t.to() != null && !states.contains(t.to())) {
                states.add(t.to());
            }
        }
        return List.copyOf(states);
    }

    private static String toState(StateMachineDef def, String action) {
        return def.transitions().stream()
                .filter(t -> action.equals(t.action()))
                .map(Transition::to)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "状态机 " + def.machineName() + " 无动作 " + action));
    }

    private static Map<String, Long> toLongMap(List<Map<String, Object>> rows) {
        Map<String, Long> out = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object bucket = first(row, "bucket", "BUCKET");
            Object cnt = first(row, "cnt", "CNT");
            if (bucket != null && cnt instanceof Number n) {
                out.put(bucket.toString(), n.longValue());
            }
        }
        return out;
    }

    private static Object first(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            if (row.containsKey(key)) {
                return row.get(key);
            }
        }
        return null;
    }
}
