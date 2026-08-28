package com.aiacademy.business.kase.service;

import com.aiacademy.business.kase.domain.CaseAuditForm;
import com.aiacademy.business.kase.domain.CaseEnums;
import com.aiacademy.business.kase.domain.CaseForm;
import com.aiacademy.business.kase.domain.CaseInfo;
import com.aiacademy.business.kase.domain.CaseListItem;
import com.aiacademy.business.kase.domain.CaseQuery;
import com.aiacademy.business.kase.repository.CaseMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.common.json.JsonArrays;
import com.aiacademy.platform.dict.domain.BusinessDomains;
import com.aiacademy.platform.dict.service.DictQuery;
import com.aiacademy.platform.people.service.EmployeeService;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 案例主表的读写（需求 12.3、12.7）。
 *
 * <p><b>本类不碰状态列，也不派发副作用。</b>状态变更的唯一入口是 {@code StateTransitionService}，
 * 副作用派发按 AR-4 归 app 层的应用服务。这里只做四件事：校验、编号、写本表的业务列、查询。
 *
 * <p><b>没有对外的「新建案例」方法。</b>{@link #createFromCourse} 只被 {@code CREATE_CASE} 副作用
 * 调用——一期案例仅来自达到精品标准的课程（议题 27、C16-b），学员成果与业务侧实践不能直接
 * 提交为案例（N10）。加一个 {@code create(CaseForm)} 出来就等于把这条范围边界打开了。
 */
@Service
public class CaseService {

    /**
     * 案例附件与封面图在 {@code sys_attachment_ref} 上的字段名（需求 12.3 第 12、13 项）。
     *
     * <p>本类不提供挂载方法：附件走平台通用的 {@code /api/attachments} 三段式（同培训归档），
     * 这两个常量只是 {@code refField} 的取值来源，避免前后端各写一个字符串。
     */
    public static final String REF_ATTACHMENTS = "case_files";
    public static final String REF_COVER = "case_cover";

    private final CaseMapper mapper;
    private final DictQuery dicts;
    private final EmployeeService employees;
    private final StateMachineRegistry stateMachines;

    public CaseService(CaseMapper mapper, DictQuery dicts, EmployeeService employees,
                       StateMachineRegistry stateMachines) {
        this.mapper = mapper;
        this.dicts = dicts;
        this.employees = employees;
        this.stateMachines = stateMachines;
    }

    /**
     * 课程标注达精品时建案例（需求 5.3.1 第 12 条）。返回案例主键。
     *
     * <p>调用方<b>必须</b>紧接着调用 {@code TransitionApplicationService.initialize} 补记
     * 「（空）→ 待整理」的流转日志，否则这条案例的起点没有时间戳，15.5 的案例上架周期会缺掉起点。
     *
     * <p>四个初值全部来自课程（需求 12.3 第 2、3、6、7 项），运营随后可改。贡献组织在需求里是
     * 必填的自由文本，而课程上没有对应字段，由调用方按负责人所在部门给一个初值。
     */
    @Transactional
    public long createFromCourse(long courseId, String caseName, String ownerNo,
                                 String contributingOrg, List<String> domainCodes) {
        // 编号是「查最大流水 + 1」，并发下会重号。两名运营同时标注两门课程达精品完全可能，
        // 靠唯一约束报错再重试，运营看到的是一次无从解释的失败
        mapper.lockCaseNoSequence();

        CaseInfo caseInfo = new CaseInfo();
        caseInfo.setCaseNo(mapper.nextCaseNo());
        caseInfo.setCaseName(caseName);
        caseInfo.setCourseId(courseId);
        caseInfo.setContributingOrg(contributingOrg);
        caseInfo.setDomainCodes(JsonArrays.toJson(domainCodes));
        caseInfo.setOwnerNo(ownerNo);
        caseInfo.setCaseState(initialState());
        return mapper.insert(caseInfo, operator());
    }

    /** 编辑案例基本信息（规则 K1 乐观锁）。 */
    @Transactional
    public void update(long id, CaseForm form, Integer expectedVersion) {
        CaseInfo current = requireExisting(id);
        validate(form);

        CaseInfo caseInfo = new CaseInfo();
        caseInfo.setId(id);
        caseInfo.setCaseName(form.caseName().trim());
        caseInfo.setContributingOrg(form.contributingOrg().trim());
        caseInfo.setContributors(JsonArrays.toJson(form.contributors()));
        caseInfo.setDomainCodes(JsonArrays.toJson(form.domainCodes()));
        caseInfo.setOwnerNo(form.ownerNo());
        caseInfo.setQualityMarks(JsonArrays.toJson(form.qualityMarks()));
        caseInfo.setContent(form.content());
        caseInfo.setExpectPublishDate(form.expectPublishDate());

        int version = expectedVersion == null ? current.getVersion() : expectedVersion;
        if (mapper.update(caseInfo, operator(), version) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 录入审核结论的字段部分（需求 12.3 第 9a～9d 项）。状态由调用方在同一事务内推进。
     *
     * <p><b>后一次覆盖前一次，不记轮次</b>（C09 第 4 条）。因此这里没有「已录入结论的不许再改」
     * 的 WHERE 条件——那是评审记录与试讲记录的规则（需求 9.8），案例审核刚好相反。
     */
    @Transactional
    public void recordAudit(long id, CaseAuditForm form) {
        CaseInfo current = requireExisting(id);
        if (!CaseEnums.REVIEW_RESULTS.contains(form.reviewResult())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "审核结论只能是：" + String.join(" / ", CaseEnums.REVIEW_RESULTS));
        }
        requireEmployee(form.reviewerNo(), "案例审核人");

        int version = form.version() == null ? current.getVersion() : form.version();
        int updated = mapper.recordAudit(id, form.reviewerNo(), form.reviewedAt(),
                blankToNull(form.reviewOpinion()), form.reviewResult(), operator(), version);
        if (updated == 0) {
            throw concurrentModified(current);
        }
    }

    /** 审核通过时写上架时间。只写一次，见 {@code CaseMapper.markPublished} 的 COALESCE。 */
    @Transactional
    public void markPublished(long id) {
        mapper.markPublished(id, operator());
    }

    @Transactional
    public void softDelete(long id) {
        if (mapper.softDelete(id, operator()) == 0) {
            throw new NotFoundException("案例不存在或已删除：" + id);
        }
    }

    @Transactional(readOnly = true)
    public CaseListItem get(long id) {
        CaseListItem item = mapper.selectDetailById(id);
        if (item == null) {
            throw new NotFoundException("案例不存在或已删除：" + id);
        }
        return item;
    }

    @Transactional(readOnly = true)
    public PageResult<CaseListItem> page(CaseQuery query) {
        long total = mapper.countPage(query);
        if (total == 0) {
            return PageResult.of(List.of(), 0, query);
        }
        return PageResult.of(
                mapper.selectPage(query, query.offset(), query.sortExpression()), total, query);
    }

    @Transactional(readOnly = true)
    public CaseInfo require(long id) {
        return requireExisting(id);
    }

    /** 一门课程至多一个案例（{@code uk_case_course}）。{@code CREATE_CASE} 用它做幂等判断。 */
    @Transactional(readOnly = true)
    public Long findIdByCourse(long courseId) {
        return mapper.selectIdByCourse(courseId);
    }

    /**
     * 初始状态「待整理」从转换表里取，不写成字面量。
     *
     * <p>{@code case_state} 是 {@code NOT NULL}，INSERT 必须带一个值；把「待整理」抄进业务代码
     * 就出现了状态定义的第二个来源，需求改掉初始状态名时它不会跟着变，而症状是 CHECK 约束报错
     * ——离原因很远（出口准则 E2-6）。
     */
    private String initialState() {
        return stateMachines.require(CaseStateMachines.OBJECT_TYPE,
                CaseStateMachines.FIELD_CASE_STATE, null,
                CaseStateMachines.ACTION_CREATE_BY_COURSE_QUALIFIED).to();
    }

    private CaseInfo requireExisting(long id) {
        CaseInfo caseInfo = mapper.selectById(id);
        if (caseInfo == null) {
            throw new NotFoundException("案例不存在或已删除：" + id);
        }
        return caseInfo;
    }

    /**
     * 表单校验。
     *
     * <p><b>只校验取值合法性，不校验业务前置条件</b>（规则 C2）：不检查「上架前正文必填」。
     * 需求 12.3 第 11 项的「上架时 M」是一条状态前置条件，而 C9 把本期允许的业务前置校验限定为
     * 三处，案例上架不在其中。硬校验会拦住运营补录历史案例——那些案例的正文可能在别处，
     * 平台上只登记它存在过。
     *
     * <p>应用领域与需求同一套现场口径。历史行仍可能是作战单元编码，那些编码继续合法。
     */
    private void validate(CaseForm form) {
        for (String domainCode : form.domainCodes()) {
            if (!isAllowedDomain(domainCode)) {
                throw new BizException(ErrorCode.PARAM_INVALID,
                        "应用领域只能是：%s".formatted(String.join(" / ", BusinessDomains.NAMES)));
            }
        }

        requireEmployee(form.ownerNo(), "案例负责人");
        if (form.contributors() != null) {
            for (String contributor : form.contributors()) {
                requireEmployee(contributor, "贡献人");
            }
        }

        if (form.qualityMarks() != null) {
            for (String mark : form.qualityMarks()) {
                if (!CaseEnums.QUALITY_MARKS.contains(mark)) {
                    throw new BizException(ErrorCode.PARAM_INVALID,
                            "精品标注只能是：" + String.join(" / ", CaseEnums.QUALITY_MARKS));
                }
            }
        }
    }

    private boolean isAllowedDomain(String value) {
        return BusinessDomains.contains(value)
                || dicts.enabledCodeSet(DictQuery.TYPE_COMBAT_UNIT).contains(value)
                || dicts.enabledNameSet(DictQuery.TYPE_COMBAT_UNIT).contains(value);
    }

    private void requireEmployee(String employeeNo, String label) {
        if (employees.findByNo(employeeNo).isEmpty()) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "%s「%s」不在人员台账中，请先在导入中心导入人员".formatted(label, employeeNo));
        }
    }

    /**
     * 冲突提示带上最后修改时间。
     *
     * <p>共享账号下界面看不出还有别人在操作，只说一句「保存失败」，运营会当成系统 bug 反复重试
     * （开发 5.10）。
     */
    private static BizException concurrentModified(CaseInfo current) {
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
