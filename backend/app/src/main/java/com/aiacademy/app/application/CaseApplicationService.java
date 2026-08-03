package com.aiacademy.app.application;

import com.aiacademy.business.kase.domain.CaseAuditForm;
import com.aiacademy.business.kase.domain.CaseEnums;
import com.aiacademy.business.kase.service.CaseService;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 案例里需要「业务写入 + 状态转换」一起完成的动作（AR-4：跨模块编排放 app 层）。
 *
 * <p>纯 CRUD 不经过这里，Controller 直接调 {@code CaseService}。
 */
@Service
public class CaseApplicationService {

    private final CaseService cases;
    private final TransitionApplicationService transitions;

    public CaseApplicationService(CaseService cases, TransitionApplicationService transitions) {
        this.cases = cases;
        this.transitions = transitions;
    }

    /**
     * 建案例并补记「（空）→ 待整理」的流转日志（需求 5.3.1 第 12 条）。
     *
     * <p>由 {@code CaseCreationEffectHandler} 在课程标注达精品的同一事务里调用。<b>没有对外的
     * HTTP 入口</b>——一期案例仅来自精品课程（议题 27）。
     *
     * <p>两步同事务。补记失败则案例一并回滚：一条没有起点时间戳的案例，会让 15.5 的案例上架
     * 周期少一条数据，而这在事后无法补齐。
     */
    @Transactional
    public long createFromCourse(long courseId, String caseName, String ownerNo,
                                 String contributingOrg, List<String> domainCodes) {
        long caseId = cases.createFromCourse(courseId, caseName, ownerNo, contributingOrg, domainCodes);
        transitions.initialize(CaseStateMachines.OBJECT_TYPE, caseId,
                CaseStateMachines.FIELD_CASE_STATE,
                CaseStateMachines.ACTION_CREATE_BY_COURSE_QUALIFIED);
        return caseId;
    }

    /**
     * 录入审核结论（需求 5.9 后两行）：写审核四字段，再按结论推进案例状态。
     *
     * <p>两件事必须在同一个事务里。分开做会产生「结论录进去了但状态还停在待审核」，或者更糟的
     * 「状态到了已上架但审核人是空的」——后者是一条谁也说不清是谁批的已上架案例。
     *
     * <p>顺序是<b>先写字段、后转状态</b>：转换的 {@code RECORD_CASE_AUDIT} 副作用要读回审核人与
     * 审核时间来复核，字段还没落库时它读到的是 NULL，整笔请求会被自己的复核拒绝。
     *
     * <p>结论到动作的映射只有一处，在 {@link CaseEnums#auditActionOf}。
     */
    @Transactional
    public void recordAudit(long caseId, CaseAuditForm form) {
        cases.recordAudit(caseId, form);
        // 版本号不带给转换：recordAudit 已经把 version 自增过，带旧值必然冲突。
        // 并发安全由那次带乐观锁的 UPDATE 兜住——两次写的是同一行
        transitions.transit(new TransitCommand(CaseStateMachines.OBJECT_TYPE, caseId,
                CaseStateMachines.FIELD_CASE_STATE,
                CaseEnums.auditActionOf(form.reviewResult()),
                null, "审核结论：" + form.reviewResult()));
    }
}
