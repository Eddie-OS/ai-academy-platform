package com.aiacademy.business.demand.service;

import com.aiacademy.business.demand.domain.Demand;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandCourseLinkForm;
import com.aiacademy.business.demand.domain.DemandProcessInfoForm;
import com.aiacademy.business.demand.domain.DemandListItem;
import com.aiacademy.business.demand.domain.DemandQuery;
import com.aiacademy.business.demand.repository.DemandMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeService;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 需求主表的读写（需求 8.3、8.6）。
 *
 * <p><b>本类不碰状态列，也不派发副作用。</b>状态变更的唯一入口是 {@code StateTransitionService}，
 * 副作用派发按 AR-4 归 app 层的应用服务。这里只做四件事：校验、编号、写本表的业务列、查询。
 *
 * <p>因此「登记需求」在本类里只完成 INSERT，「（空）→ 待评审」这一跳由 app 层在同一事务内补记。
 */
@Service
public class DemandService {

    private final DemandMapper mapper;
    private final EmployeeService employees;
    private final StateMachineRegistry stateMachines;

    public DemandService(DemandMapper mapper, EmployeeService employees,
                         StateMachineRegistry stateMachines) {
        this.mapper = mapper;
        this.employees = employees;
        this.stateMachines = stateMachines;
    }

    /**
     * 插入一条需求，返回主键。评审状态直接落「待评审」，因为 {@code review_state} 是 {@code NOT NULL}。
     *
     * <p>调用方<b>必须</b>紧接着调用 {@code TransitionApplicationService.initialize} 补记流转日志，
     * 否则这条需求的「待评审」时刻没有时间戳，需求 15.2 的需求处理周期会缺掉起点。
     */
    @Transactional
    public long create(DemandForm form) {
        validate(form);

        // 编号是「查最大流水 + 1」，并发下会重号。共享账号让并发录入成为常态，靠唯一约束报错再
        // 重试，运营看到的是一次无从解释的失败
        mapper.lockDemandNoSequence();

        Demand demand = new Demand();
        applyForm(demand, form);
        demand.setDemandNo(mapper.nextDemandNo());
        demand.setReviewState(initialReviewState());
        return mapper.insert(demand, operator());
    }

    /** 编辑需求基本信息（规则 K1 乐观锁）。 */
    @Transactional
    public void update(long id, DemandForm form, Integer expectedVersion) {
        validate(form);
        Demand current = requireExisting(id);

        Demand demand = new Demand();
        applyForm(demand, form);
        demand.setId(id);

        int version = expectedVersion == null ? current.getVersion() : expectedVersion;
        if (mapper.update(demand, operator(), version) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 「分流与处理」页签只改业务字段，不写状态列。
     */
    @Transactional
    public void updateProcessSnapshot(long id, DemandProcessInfoForm form, String outlet) {
        Demand current = requireExisting(id);
        String link = blankToNull(form.solutionLink());
        if (link != null && !link.startsWith("http://") && !link.startsWith("https://")) {
            throw new BizException(ErrorCode.PARAM_INVALID, "关联链接请以 http:// 或 https:// 开头");
        }
        if (mapper.updateProcessSnapshot(id, outlet,
                blankToNull(form.solutionName()), blankToNull(form.solutionRemark()),
                blankToNull(form.devName()), blankToNull(form.devRemark()),
                form.expectFinishDate(),
                blankToNull(form.acceptanceRemark()), blankToNull(form.deliveryRemark()),
                form.actualFinishDate(), link, operator(), form.version()) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 「关联课程」页签只改外链，不写状态列。
     */
    @Transactional
    public void updateCourseLink(long id, DemandCourseLinkForm form) {
        Demand current = requireExisting(id);
        String link = blankToNull(form.courseLink());
        if (link != null && !link.startsWith("http://") && !link.startsWith("https://")) {
            throw new BizException(ErrorCode.PARAM_INVALID, "关联链接请以 http:// 或 https:// 开头");
        }
        if (mapper.updateCourseLink(id, link, operator(), form.version()) == 0) {
            throw concurrentModified(current);
        }
    }

    @Transactional
    public void softDelete(long id) {
        if (mapper.softDelete(id, operator()) == 0) {
            throw new NotFoundException("需求不存在或已删除：" + id);
        }
    }

    @Transactional(readOnly = true)
    public DemandListItem get(long id) {
        DemandListItem item = mapper.selectDetailById(id);
        if (item == null) {
            throw new NotFoundException("需求不存在或已删除：" + id);
        }
        return item;
    }

    @Transactional(readOnly = true)
    public PageResult<DemandListItem> page(DemandQuery query) {
        long total = mapper.countPage(query);
        if (total == 0) {
            return PageResult.of(List.of(), 0, query);
        }
        return PageResult.of(mapper.selectPage(
                query, query.offset(), query.sortColumn(), query.sortDirection()), total, query);
    }

    @Transactional(readOnly = true)
    public Demand require(long id) {
        return requireExisting(id);
    }

    /**
     * 初始评审状态从转换表里取，不写成字面量。
     *
     * <p>{@code review_state} 是 {@code NOT NULL}，INSERT 必须带一个值；把「待评审」抄进业务代码，
     * 就出现了状态定义的第二个来源，需求改掉初始状态名时它不会跟着变，而症状是 CHECK 约束
     * 报错——离原因很远。A-6 的门禁也禁止业务代码出现状态值字面量。
     */
    private String initialReviewState() {
        return stateMachines.require(DemandStateMachines.OBJECT_TYPE,
                DemandStateMachines.FIELD_REVIEW_STATE, null, DemandStateMachines.ACTION_REGISTER).to();
    }

    private Demand requireExisting(long id) {
        Demand demand = mapper.selectById(id);
        if (demand == null) {
            throw new NotFoundException("需求不存在或已删除：" + id);
        }
        return demand;
    }

    private void applyForm(Demand demand, DemandForm form) {
        demand.setDemandName(form.demandName().trim());
        demand.setDomainCode(form.domainCode().trim());
        demand.setProposerNo(form.proposerNo().trim());
        demand.setProposerDept(deptOf(form.proposerNo().trim()));
        demand.setOwnerNo(form.ownerNo().trim());
        demand.setOwnerNames(blankToNull(form.ownerNames()) != null
                ? form.ownerNames().trim() : form.ownerNo().trim());
        demand.setProposedDate(form.proposedDate());
        demand.setExpectFinishDate(form.expectFinishDate());
        demand.setDescription(form.description());
        demand.setDemandSource(blankToNull(form.demandSource()));
        demand.setDemandType(blankToNull(form.demandType()));
        demand.setPriority(blankToNull(form.priority()));
        demand.setBusinessBackground(blankToNull(form.businessBackground()));
        demand.setRoiAnalysis(blankToNull(form.roiAnalysis()));
        demand.setRemark(blankToNull(form.remark()));
    }

    /**
     * 提出人部门随提出人自动带出（需求 8.3.1 第 5 项）。
     *
     * <p>存的是<b>快照文本</b>而不是每次 JOIN 出来：提出人半年后调岗，这条需求当时归属哪个部门
     * 不应该跟着变——需求 13.9.3 的领域口径与 15 章的部门维度统计都按录入当时的归属看。
     */
    private String deptOf(String employeeNo) {
        return employees.findByNo(employeeNo).map(Employee::getDeptName).orElse(null);
    }

    /**
     * 表单校验。
     *
     * <p><b>只校验取值合法性，不校验业务前置条件</b>（规则 C2）：不检查预计完成时间是否晚于提出
     * 时间。运营录入的大多是已经发生的历史数据，日期本来就可能「不合常理」，拦下来只会逼他们
     * 改数据去迁就系统。
     *
     * <p>所属领域：现场口径（D-21）允许零售／GTM 等固定项或手填；历史数据仍可能是作战单元编码，
     * 那些编码继续合法，避免改一条旧需求就被拒。
     */
    private void validate(DemandForm form) {
        String domain = form.domainCode() == null ? "" : form.domainCode().trim();
        if (domain.isEmpty() || DemandEnums.DOMAIN_MANUAL.equals(domain)) {
            throw new BizException(ErrorCode.PARAM_INVALID, "请选择或填写所属领域");
        }
        if (domain.length() > 64) {
            throw new BizException(ErrorCode.PARAM_INVALID, "所属领域不超过 64 字");
        }
        if (form.proposerNo() != null && form.proposerNo().trim().length() > 50) {
            throw new BizException(ErrorCode.PARAM_INVALID, "需求提出人不超过 50 字");
        }
        if (form.ownerNo() != null && form.ownerNo().trim().length() > 50) {
            throw new BizException(ErrorCode.PARAM_INVALID, "需求负责人单人姓名不超过 50 字");
        }

        requireInIfPresent(DemandEnums.SOURCES, form.demandSource(), "需求来源");
        requireInIfPresent(DemandEnums.TYPES, form.demandType(), "需求类型");
        requireInIfPresent(DemandEnums.PRIORITIES, form.priority(), "优先级");
    }

    private static void requireInIfPresent(List<String> allowed, String value, String label) {
        if (value == null || value.isBlank()) {
            return;
        }
        if (!allowed.contains(value)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "%s只能是：%s".formatted(label, String.join(" / ", allowed)));
        }
    }

    /**
     * 冲突提示带上最后修改时间。
     *
     * <p>共享账号下界面看不出还有别人在操作，只说一句「保存失败」，运营会当成系统 bug 反复重试
     * （开发 5.10）。
     */
    private static BizException concurrentModified(Demand current) {
        return new BizException(ErrorCode.CONCURRENT_MODIFIED,
                "该记录已被他人修改（最后修改：%s），请刷新后重试"
                        .formatted(current.getUpdatedAt() == null ? "未知时间" : current.getUpdatedAt()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
