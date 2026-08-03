package com.aiacademy.business.training.service;

import com.aiacademy.business.training.domain.TrainingPlan;
import com.aiacademy.business.training.domain.TrainingPlanForm;
import com.aiacademy.business.training.domain.TrainingPlanListItem;
import com.aiacademy.business.training.domain.TrainingPlanQuery;
import com.aiacademy.business.training.repository.TrainingPlanMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.people.service.EmployeeService;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 培训计划主表的读写（需求 11.3、11.8）。
 *
 * <p><b>本类不碰状态列，也不派发副作用。</b>状态变更的唯一入口是 {@code StateTransitionService}，
 * 副作用派发按 AR-4 归 app 层。因此「新建计划」在这里只完成 INSERT，「（空）→ 待执行」那一跳
 * 由 app 层在同一事务内补记。
 *
 * <p><b>关联课程的存在性不在这里校验。</b>课程属另一个业务模块，跨模块校验按 AR-1／AR-4 归 app 层。
 */
@Service
public class TrainingPlanService {

    private final TrainingPlanMapper mapper;
    private final EmployeeService employees;
    private final StateMachineRegistry stateMachines;

    public TrainingPlanService(TrainingPlanMapper mapper, EmployeeService employees,
                               StateMachineRegistry stateMachines) {
        this.mapper = mapper;
        this.employees = employees;
        this.stateMachines = stateMachines;
    }

    /**
     * 插入一条培训计划，返回主键。计划状态直接落「待执行」，因为 {@code plan_state} 是
     * {@code NOT NULL}。
     *
     * <p>调用方<b>必须</b>紧接着补记流转日志，否则这条计划的「待执行」时刻没有时间戳。
     */
    @Transactional
    public long create(TrainingPlanForm form) {
        validate(form);

        mapper.lockPlanNoSequence();

        TrainingPlan plan = new TrainingPlan();
        applyForm(plan, form);
        plan.setPlanNo(mapper.nextPlanNo());
        plan.setPlanState(initialPlanState());
        return mapper.insert(plan, operator());
    }

    @Transactional
    public void update(long id, TrainingPlanForm form) {
        validate(form);
        requireExisting(id);

        TrainingPlan plan = new TrainingPlan();
        applyForm(plan, form);
        plan.setId(id);
        mapper.update(plan, operator());
    }

    /**
     * 逻辑删除（SEC2）。
     *
     * <p>下面还挂着场次时拒绝：场次的入口只有计划详情页，计划一删，那些场次连同它们的签到、
     * 反馈、归档材料就成了没有入口的孤儿数据——而它们并没有被删除，仍会出现在指标统计里。
     */
    @Transactional
    public void softDelete(long id) {
        int sessions = mapper.countSessions(id);
        if (sessions > 0) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "该计划下还有 %d 个培训场次，请先删除场次再删除计划".formatted(sessions));
        }
        if (mapper.softDelete(id, operator()) == 0) {
            throw new NotFoundException("培训计划不存在或已删除：" + id);
        }
    }

    /** 首次进入「已完成」时写实际完成时间（需求 11.3 第 12 项）。由 app 层的副作用处理器调用。 */
    @Transactional
    public void markFinished(long id) {
        if (mapper.markFinished(id, LocalDate.now(), operator()) == 0) {
            throw new NotFoundException("培训计划不存在或已删除：" + id);
        }
    }

    @Transactional(readOnly = true)
    public TrainingPlanListItem get(long id) {
        TrainingPlanListItem item = mapper.selectDetailById(id);
        if (item == null) {
            throw new NotFoundException("培训计划不存在或已删除：" + id);
        }
        return item;
    }

    @Transactional(readOnly = true)
    public PageResult<TrainingPlanListItem> page(TrainingPlanQuery query) {
        long total = mapper.countPage(query);
        if (total == 0) {
            return PageResult.of(List.of(), 0, query);
        }
        return PageResult.of(mapper.selectPage(
                query, query.offset(), query.sortColumn(), query.sortDirection()), total, query);
    }

    @Transactional(readOnly = true)
    public TrainingPlan require(long id) {
        return requireExisting(id);
    }

    /**
     * 初始计划状态从转换表里取，不写成字面量——写进业务代码就出现了状态定义的第二个来源，
     * 需求改掉初始状态名时它不会跟着变，而症状是 CHECK 约束报错，离原因很远。
     */
    private String initialPlanState() {
        return stateMachines.require(TrainingStateMachines.PLAN_OBJECT_TYPE,
                TrainingStateMachines.FIELD_PLAN_STATE, null,
                TrainingStateMachines.ACTION_CREATE_PLAN).to();
    }

    private TrainingPlan requireExisting(long id) {
        TrainingPlan plan = mapper.selectById(id);
        if (plan == null) {
            throw new NotFoundException("培训计划不存在或已删除：" + id);
        }
        return plan;
    }

    private void applyForm(TrainingPlan plan, TrainingPlanForm form) {
        plan.setPlanName(form.planName().trim());
        plan.setCourseId(form.courseId());
        plan.setOwnerNo(form.ownerNo());
        plan.setTargetScope(form.targetScope().trim());
        plan.setPlanStartDate(form.planStartDate());
        plan.setPlanEndDate(form.planEndDate());
        plan.setPlanSessionCount(form.planSessionCount());
        plan.setRemark(blankToNull(form.remark()));
    }

    /**
     * 表单校验。
     *
     * <p><b>结束日期早于开始日期是要拦的</b>——这不是业务前置条件（C2 管的是状态变更的前置），
     * 而是字段自身的取值合法性：计划结束日期是三色灯的判定基准，倒挂的区间会让预警立刻算出
     * 一个没有意义的逾期天数。
     */
    private void validate(TrainingPlanForm form) {
        if (employees.findByNo(form.ownerNo()).isEmpty()) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "培训负责人「%s」不在人员台账中，请先在导入中心导入人员".formatted(form.ownerNo()));
        }
        if (form.planEndDate().isBefore(form.planStartDate())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "计划结束日期不能早于计划开始日期");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
