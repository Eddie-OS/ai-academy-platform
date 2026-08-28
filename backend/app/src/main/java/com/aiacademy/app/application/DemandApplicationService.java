package com.aiacademy.app.application;

import com.aiacademy.business.demand.domain.Demand;
import com.aiacademy.business.demand.domain.DemandAcceptanceForm;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandReviewForm;
import com.aiacademy.business.demand.domain.DemandProcessInfoForm;
import com.aiacademy.business.demand.domain.DemandReviewInfoForm;
import com.aiacademy.business.demand.service.DemandAcceptanceService;
import com.aiacademy.business.demand.service.DemandReviewService;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 需求里需要「业务写入 + 状态转换」一起完成的动作（AR-4：跨模块编排放 app 层）。
 *
 * <p>纯 CRUD 不经过这里，Controller 直接调 {@code DemandService}。
 */
@Service
public class DemandApplicationService {

    private final DemandService demands;
    private final DemandReviewService reviews;
    private final DemandAcceptanceService acceptances;
    private final TransitionApplicationService transitions;

    public DemandApplicationService(DemandService demands, DemandReviewService reviews,
                                    DemandAcceptanceService acceptances,
                                    TransitionApplicationService transitions) {
        this.demands = demands;
        this.reviews = reviews;
        this.acceptances = acceptances;
        this.transitions = transitions;
    }

    /**
     * 登记一条需求：INSERT 之后补记「（空）→ 待评审」的流转日志，并派发它的副作用
     * （需求 5.2.1 要求派生一条「需求评审」任务，阶段 3 落地）。
     *
     * <p>两步同事务。补记失败则需求一并回滚——一条没有登记时间戳的需求，会让需求 15.2 的
     * 需求处理周期少一条数据，而这在事后无法补齐。
     */
    @Transactional
    public long register(DemandForm form) {
        long id = demands.create(form);
        transitions.initialize(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_REVIEW_STATE, DemandStateMachines.ACTION_REGISTER);
        return id;
    }

    /**
     * 录入评审结论（需求 5.2.1 第 3 行）：写主表的评审字段与分流出口、建一条评审记录、
     * 推进评审状态到「已评审」。
     *
     * <p>三件事必须在同一个事务里。分开做会产生「结论录进去了但状态还停在评审中」，或者更糟的
     * 「状态到了已评审但出口是空的」——后者的需求没有任何可执行动作，运营只会觉得它卡住了。
     *
     * <p>顺序是<b>先写字段、后转状态</b>：转换的 {@code REQUIRE_OUTLET} 副作用要读回出口来复核，
     * 字段还没落库时它读到的是 NULL，整笔请求会被自己的复核拒绝。
     */
    @Transactional
    public long recordReviewConclusion(long demandId, DemandReviewForm form) {
        long reviewId = reviews.recordConclusion(demandId, form);
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_REVIEW_STATE,
                DemandStateMachines.ACTION_RECORD_REVIEW_RESULT,
                null, "分流出口：" + form.outlet()));
        return reviewId;
    }

    /**
     * 详情「评审信息」整页保存：按目标状态走转换表，结论映射出口，意见／备注写主表快照。
     *
     * <p>不自动连跳。转换表没有的组合（例如跳过中间态）直接 {@code ILLEGAL_TRANSITION}。
     * 状态未变时只更新快照，不 INSERT 历史行。
     */
    @Transactional
    public void saveReviewInfo(long demandId, DemandReviewInfoForm form) {
        Demand current = demands.require(demandId);
        validateReviewInfo(form);

        String outlet = DemandEnums.outletOfConclusion(form.reviewConclusion().trim());
        if (outlet == null) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "评审结论只能是：%s".formatted(String.join(" / ", DemandEnums.REVIEW_CONCLUSIONS)));
        }

        String from = current.getReviewState();
        String to = form.reviewState().trim();
        if (!reviewStates().contains(to)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "评审状态只能是：%s".formatted(String.join(" / ", reviewStates())));
        }

        if (from.equals(to)) {
            reviews.updateSnapshot(demandId, form, outlet, isReviewed(from), form.version());
            return;
        }

        Transition transition = transitionOf(from, to);
        if (transition == null) {
            throw new BizException(ErrorCode.ILLEGAL_TRANSITION,
                    "当前状态为「%s」，不能改为「%s」".formatted(from, to),
                    Map.of("currentState", from, "action", to));
        }

        if (DemandStateMachines.ACTION_RECORD_REVIEW_RESULT.equals(transition.action())) {
            reviews.recordConclusion(demandId, new DemandReviewForm(
                            LocalDate.now(), form.reviewConclusion().trim(), form.reviewOpinion().trim(),
                            outlet, form.version()),
                    form.reviewRemark(), form.priority());
            transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                    DemandStateMachines.FIELD_REVIEW_STATE,
                    DemandStateMachines.ACTION_RECORD_REVIEW_RESULT,
                    null, "分流出口：" + outlet));
            return;
        }

        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_REVIEW_STATE, transition.action(), form.version(), null));
        reviews.updateSnapshot(demandId, form, outlet, false, null);
    }

    /**
     * 输出解决方案（需求 5.2.3 第 1 行）：写方案名称 + 建立解决方案状态。
     *
     * <p>方案名称不走通用编辑接口，因为需求 8.3.3 第 22 项要求它在出口一时必填——放进那个表单
     * 就没法表达这个必填，也没法保证「有解决方案状态 ⇔ 有方案名称」。
     */
    @Transactional
    public void createSolution(long demandId, String solutionName, Integer version) {
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_SOLUTION_STATE, DemandStateMachines.ACTION_CREATE_SOLUTION,
                version, "解决方案：" + solutionName));
        reviews.writeSolutionName(demandId, solutionName);
    }

    /**
     * 详情「分流与处理」整页保存：写名称／备注／日期／链接，再按转换表推进各状态机一跳。
     *
     * <p>不自动连跳。录入验收结论仍走业务验收页签——那一跳要同时写验收人与结论记录。
     */
    @Transactional
    public void saveProcessInfo(long demandId, DemandProcessInfoForm form) {
        Demand current = demands.require(demandId);
        String outlet = form.outlet().trim();
        if (!DemandEnums.OUTLET_SOLUTION.equals(outlet)
                && !DemandEnums.OUTLET_DEVELOPMENT.equals(outlet)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "流转去向只能是：%s / %s".formatted(
                            DemandEnums.OUTLET_SOLUTION, DemandEnums.OUTLET_DEVELOPMENT));
        }
        if (DemandEnums.OUTLET_REJECT.equals(current.getOutlet())) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "该需求已走驳回出口，请先在「评审信息」重新评审再选流转去向");
        }
        if (current.getOutlet() != null && !current.getOutlet().equals(outlet)
                && (current.getSolutionState() != null || current.getDevState() != null)) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED, "已进入处理流程，不能改流转去向");
        }

        demands.updateProcessSnapshot(demandId, form, outlet);

        if (DemandEnums.OUTLET_SOLUTION.equals(outlet)) {
            applyMachineHop(demandId, DemandStateMachines.solution(),
                    DemandStateMachines.FIELD_SOLUTION_STATE,
                    current.getSolutionState(), normalizePendingOutput(form.solutionState()),
                    form, true);
        } else {
            applyMachineHop(demandId, DemandStateMachines.development(),
                    DemandStateMachines.FIELD_DEV_STATE,
                    current.getDevState(), blankToNull(form.devState()),
                    form, false);
        }
        applyDeliveryAndAcceptance(demandId, current, form);
    }

    /**
     * 标记交付使用（需求 5.2.5 第 1 行）：<b>一次点击推进两个状态机</b>——需求交付标记
     * （空 → 已交付）与业务验收状态（空 → 待验收）。
     *
     * <p>需求 5.13 把「需求交付标记」与「需求业务验收状态」列为两个独立状态机，而 5.2.5 的
     * 两张表都由「标记交付使用」这一个动作驱动。两跳必须同事务：只推交付标记的话，需求会停在
     * 一个没有验收状态、也没有任何验收动作可点的中间态；只推验收状态的话，它永远归不了档。
     *
     * <p>先交付标记后验收状态，是为了让流转日志的顺序与业务顺序一致（先交付、才谈验收）。
     * 两跳都带 {@code SET_DELIVERED_AT}，写交付时间的 SQL 用 COALESCE 保证只落一次。
     * 版本号只带给第一跳：第一跳已经把 {@code version} 自增过，第二跳再带旧值必然冲突。
     */
    @Transactional
    public void markDelivered(long demandId, Integer version) {
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_DELIVERY_MARK,
                DemandStateMachines.ACTION_MARK_DELIVERED, version, null));
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_ACCEPTANCE_STATE,
                DemandStateMachines.ACTION_MARK_DELIVERED, null, null));
    }

    /**
     * 录入验收结论（需求 5.2.5 第 2、3 行）：写主表验收字段、建一条验收记录、按结论推进验收状态。
     *
     * <p>顺序与录入评审结论一致——<b>先写字段、后转状态</b>：转换的 {@code RECORD_ACCEPTANCE}
     * 副作用要读回验收人与验收时间来复核，字段还没落库时它读到的是 NULL，整笔请求会被自己的
     * 复核拒绝。
     *
     * <p>结论到动作的映射只有这一处：通过走「录入验收结论=通过」，不通过走「录入验收结论=不通过」，
     * 后者还会触发按出口退回（见 {@code DemandAcceptanceEffectHandler}）。
     *
     * @return 新建的验收记录主键
     */
    @Transactional
    public long recordAcceptanceConclusion(long demandId, DemandAcceptanceForm form) {
        long acceptanceId = acceptances.recordConclusion(demandId, form);
        String action = DemandEnums.ACCEPTANCE_PASS.equals(form.acceptanceResult())
                ? DemandStateMachines.ACTION_RECORD_ACCEPTANCE_PASS
                : DemandStateMachines.ACTION_RECORD_ACCEPTANCE_REJECT;
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                DemandStateMachines.FIELD_ACCEPTANCE_STATE, action,
                null, "验收结论：" + form.acceptanceResult()));
        return acceptanceId;
    }

    private static void validateReviewInfo(DemandReviewInfoForm form) {
        if (!DemandEnums.REVIEW_CONCLUSIONS.contains(form.reviewConclusion().trim())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "评审结论只能是：%s".formatted(String.join(" / ", DemandEnums.REVIEW_CONCLUSIONS)));
        }
        String priority = form.priority();
        if (priority != null && !priority.isBlank() && !DemandEnums.PRIORITIES.contains(priority.trim())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "开发优先级只能是：%s".formatted(String.join(" / ", DemandEnums.PRIORITIES)));
        }
    }

    private static boolean isReviewed(String state) {
        return reviewedState().equals(state);
    }

    /** 录入评审结论那一跳的目标状态，从转换表取，不在业务代码里写状态值。 */
    private static String reviewedState() {
        return DemandStateMachines.review().transitions().stream()
                .filter(item -> DemandStateMachines.ACTION_RECORD_REVIEW_RESULT.equals(item.action()))
                .map(Transition::to)
                .findFirst()
                .orElseThrow();
    }

    private static Transition transitionOf(String from, String to) {
        return transitionOf(DemandStateMachines.review(), from, to);
    }

    private static Transition transitionOf(StateMachineDef machine, String from, String to) {
        return machine.transitions().stream()
                .filter(item -> Objects.equals(item.from(), from) && Objects.equals(item.to(), to))
                .findFirst()
                .orElse(null);
    }

    private void applyMachineHop(long demandId, StateMachineDef machine, String stateField,
                                 String from, String to, DemandProcessInfoForm form,
                                 boolean solutionPath) {
        if (Objects.equals(from, to)) {
            return;
        }
        if (to == null && from != null) {
            throw illegalHop(displayOrPending(from), DemandEnums.PROCESS_PENDING_OUTPUT);
        }
        Transition transition = transitionOf(machine, from, to);
        if (transition == null) {
            throw illegalHop(displayOrPending(from), to);
        }
        if (DemandStateMachines.ACTION_CREATE_SOLUTION.equals(transition.action())) {
            String name = form.solutionName();
            if (name == null || name.isBlank()) {
                throw new BizException(ErrorCode.PARAM_INVALID, "请填写解决方案名称");
            }
            createSolution(demandId, name.trim(), null);
            return;
        }
        if (DemandStateMachines.ACTION_RECORD_ACCEPTANCE_PASS.equals(transition.action())
                || DemandStateMachines.ACTION_RECORD_ACCEPTANCE_REJECT.equals(transition.action())) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "请到「业务验收」页签录入验收结论（须同时填写验收人与结论）");
        }
        if (DemandStateMachines.ACTION_MARK_DELIVERED.equals(transition.action())) {
            markDelivered(demandId, null);
            return;
        }
        String remark = solutionPath ? form.solutionRemark() : form.devRemark();
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, demandId,
                stateField, transition.action(), null, blankToNull(remark)));
    }

    private void applyDeliveryAndAcceptance(long demandId, Demand before, DemandProcessInfoForm form) {
        String deliveryTo = normalizeUndelivered(form.deliveryMark());
        String acceptanceTo = blankToNull(form.acceptanceState());
        boolean startDelivery = before.getDeliveryMark() == null && deliveryTo != null;
        boolean startAcceptance = before.getAcceptanceState() == null && acceptanceTo != null;
        if (startDelivery || startAcceptance) {
            Transition deliveryHop = transitionOf(DemandStateMachines.deliveryMark(),
                    before.getDeliveryMark(), deliveryTo);
            Transition acceptanceHop = transitionOf(DemandStateMachines.acceptance(),
                    before.getAcceptanceState(), acceptanceTo);
            boolean mark = (deliveryHop != null
                    && DemandStateMachines.ACTION_MARK_DELIVERED.equals(deliveryHop.action()))
                    || (acceptanceHop != null
                    && DemandStateMachines.ACTION_MARK_DELIVERED.equals(acceptanceHop.action()));
            if (mark) {
                markDelivered(demandId, null);
            } else if (startDelivery) {
                applyMachineHop(demandId, DemandStateMachines.deliveryMark(),
                        DemandStateMachines.FIELD_DELIVERY_MARK,
                        before.getDeliveryMark(), deliveryTo, form, false);
            } else {
                applyMachineHop(demandId, DemandStateMachines.acceptance(),
                        DemandStateMachines.FIELD_ACCEPTANCE_STATE,
                        before.getAcceptanceState(), acceptanceTo, form, false);
            }
        }

        Demand latest = demands.require(demandId);
        if (deliveryTo != null && !Objects.equals(latest.getDeliveryMark(), deliveryTo)) {
            applyMachineHop(demandId, DemandStateMachines.deliveryMark(),
                    DemandStateMachines.FIELD_DELIVERY_MARK,
                    latest.getDeliveryMark(), deliveryTo, form, false);
        }
        latest = demands.require(demandId);
        if (acceptanceTo != null && !Objects.equals(latest.getAcceptanceState(), acceptanceTo)) {
            applyMachineHop(demandId, DemandStateMachines.acceptance(),
                    DemandStateMachines.FIELD_ACCEPTANCE_STATE,
                    latest.getAcceptanceState(), acceptanceTo, form, false);
        }
    }

    private static String normalizePendingOutput(String state) {
        String value = blankToNull(state);
        return DemandEnums.PROCESS_PENDING_OUTPUT.equals(value) ? null : value;
    }

    private static String normalizeUndelivered(String mark) {
        String value = blankToNull(mark);
        return DemandEnums.DELIVERY_UNDELIVERED.equals(value) ? null : value;
    }

    private static String displayOrPending(String state) {
        return state == null ? DemandEnums.PROCESS_PENDING_OUTPUT : state;
    }

    private static BizException illegalHop(String from, String to) {
        return new BizException(ErrorCode.ILLEGAL_TRANSITION,
                "当前状态为「%s」，不能改为「%s」".formatted(from, to),
                Map.of("currentState", from, "action", to));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static List<String> reviewStates() {
        LinkedHashSet<String> states = new LinkedHashSet<>();
        for (Transition item : DemandStateMachines.review().transitions()) {
            if (item.from() != null) {
                states.add(item.from());
            }
            if (item.to() != null) {
                states.add(item.to());
            }
        }
        return List.copyOf(states);
    }
}
