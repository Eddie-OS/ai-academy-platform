package com.aiacademy.app.kase;

import com.aiacademy.app.application.CaseApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.kase.domain.CaseAuditForm;
import com.aiacademy.business.kase.domain.CaseEnums;
import com.aiacademy.business.kase.domain.CaseForm;
import com.aiacademy.business.kase.domain.CaseListItem;
import com.aiacademy.business.kase.domain.CaseQuery;
import com.aiacademy.business.kase.service.CaseService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 案例主线（需求 12.3、5.9，页面 P5-2／P5-3）。
 *
 * <p>本类盯住案例模块与其他四个驾驶舱最不一样的四件事：
 * <ul>
 *   <li><b>案例不能手工新建</b>：唯一来源是课程标注达精品时的 {@code CREATE_CASE} 副作用（议题 27）；
 *   <li><b>审核不记轮次</b>：后一次覆盖前一次（C09 第 4 条），与需求的业务验收刚好相反；
 *   <li><b>上架前必须审核通过</b>：C9 三处硬阻断之一，一半靠转换表、一半靠副作用复核；
 *   <li><b>上架时间只写一次</b>：反复下架再上架时它不重算（15.5 案例上架周期的终点）。
 * </ul>
 */
class CaseIntegrationTest extends IntegrationTest {

    @Autowired
    private CaseService cases;

    @Autowired
    private CaseApplicationService application;

    @Autowired
    private TransitionApplicationService transitions;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 自动创建（需求 5.3.1 第 12 条、议题 27）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 5.3.1 第 12 条：课程标注达精品时自动建案例，四个初值取自课程")
    void 课程达精品自动建案例() {
        String ownerNo = 造人员("精品课负责人", "客服中心");
        long courseId = 造推广中的课程("大模型应用实战", ownerNo);

        标注达精品(courseId);

        Long caseId = cases.findIdByCourse(courseId);
        assertThat(caseId).isNotNull();

        CaseListItem saved = cases.get(caseId);
        assertThat(saved.getCaseNo()).matches("AL\\d{6}\\d{3,}");
        assertThat(saved.getCaseName()).isEqualTo("大模型应用实战");
        assertThat(saved.getOwnerNo()).isEqualTo(ownerNo);
        assertThat(saved.getContributingOrg())
                .describedAs("课程上没有贡献组织字段，用负责人所在部门做初值")
                .isEqualTo("客服中心");
        assertThat(saved.getDomainCodes()).isEqualTo("[\"" + 启用中的作战单元编码() + "\"]");
        assertThat(saved.getCaseState()).isEqualTo(初始状态());
        assertThat(saved.getPublishedAt()).isNull();
    }

    @Test
    @DisplayName("出口准则 E1-2：自动建的案例带「（空）→ 待整理」的流转日志与 last_state_changed_at")
    void 自动建案例补记流转日志() {
        long courseId = 造推广中的课程("有日志的课", 造人员("有日志课负责人", "客服中心"));
        标注达精品(courseId);
        long caseId = cases.findIdByCourse(courseId);

        Integer logs = jdbc.queryForObject("""
                SELECT COUNT(*) FROM audit_state_log
                 WHERE object_type = ? AND object_id = ? AND from_state IS NULL AND to_state = ?
                """, Integer.class, CaseStateMachines.OBJECT_TYPE, caseId, 初始状态());
        assertThat(logs).isEqualTo(1);
        assertThat(cases.get(caseId).getLastStateChangedAt())
                .describedAs("红灯判定的唯一依据，缺了它这条案例永远不会停滞报警")
                .isNotNull();
    }

    @Test
    @DisplayName("规则 K2：同一门课程重复触发 CREATE_CASE 不建第二个案例，也不撞唯一约束")
    void 重复触发不建第二个案例() {
        long courseId = 造推广中的课程("只该有一个案例的课", 造人员("唯一案例课负责人", "客服中心"));
        标注达精品(courseId);
        long first = cases.findIdByCourse(courseId);

        // 直接再派发一次副作用：现实里的触发路径是课程从「精品案例」退回推广后再次标注
        标注达精品(courseId, false);

        assertThat(cases.findIdByCourse(courseId)).isEqualTo(first);
    }

    @Test
    @DisplayName("N10／议题 27：案例模块没有对外的新建接口，唯一来源是精品课程")
    void 没有手工新建入口() {
        assertThat(CaseService.class.getMethods())
                .describedAs("看到 CaseController 里只有编辑没有新建时，不要顺手补一个 create")
                .noneMatch(method -> method.getName().equals("create"));
    }

    // -------------------------------------------------------------------------
    // 审核（需求 12.3 第 9a～9d 项、5.9）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 5.9：审核通过后案例上架，四个审核字段与上架时间一并落库")
    void 审核通过后上架() {
        long caseId = 造待审核案例("待审核的案例");
        String reviewerNo = 造人员("案例审核人", "AI 学院");

        application.recordAudit(caseId, new CaseAuditForm(reviewerNo, LocalDate.now(),
                "内容完整，同意上架", CaseEnums.AUDIT_PASS, null));

        CaseListItem after = cases.get(caseId);
        assertThat(after.getCaseState()).isEqualTo("已上架");
        assertThat(after.getReviewerNo()).isEqualTo(reviewerNo);
        assertThat(after.getReviewResult()).isEqualTo(CaseEnums.AUDIT_PASS);
        assertThat(after.getPublishedAt())
                .describedAs("案例上架周期的终点，缺了它 15.5 的周期算不出来")
                .isNotNull();
    }

    @Test
    @DisplayName("C09 第 4 条：审核不记轮次，第二次审核直接覆盖第一次，不建历史记录")
    void 审核后一次覆盖前一次() {
        long caseId = 造待审核案例("要审两次的案例");
        String 第一位 = 造人员("第一位审核人", "AI 学院");
        String 第二位 = 造人员("第二位审核人", "AI 学院");

        application.recordAudit(caseId, new CaseAuditForm(第一位, LocalDate.now().minusDays(3),
                "正文太单薄", CaseEnums.AUDIT_REJECT, null));
        assertThat(cases.get(caseId).getCaseState())
                .describedAs("不通过退回整理中，不是停在待审核")
                .isEqualTo("整理中");

        提交审核(caseId);
        application.recordAudit(caseId, new CaseAuditForm(第二位, LocalDate.now(),
                "已补充，同意", CaseEnums.AUDIT_PASS, null));

        CaseListItem after = cases.get(caseId);
        assertThat(after.getReviewerNo()).isEqualTo(第二位);
        assertThat(after.getReviewOpinion()).isEqualTo("已补充，同意");
        assertThat(after.getReviewResult()).isEqualTo(CaseEnums.AUDIT_PASS);
    }

    @Test
    @DisplayName("C9 硬阻断上半：转换表里没有「整理中 → 已上架」，跳过审核直接上架被拒")
    void 整理中不能直接上架() {
        long caseId = 造整理中案例("想跳过审核的案例");

        assertThatThrownBy(() -> transitions.transit(new TransitCommand(
                CaseStateMachines.OBJECT_TYPE, caseId, CaseStateMachines.FIELD_CASE_STATE,
                CaseStateMachines.ACTION_AUDIT_PASS, null, null)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.ILLEGAL_TRANSITION));
    }

    @Test
    @DisplayName("C9 硬阻断下半：绕过审核结论接口、直接推「录入审核结论=通过」时副作用当场拒绝")
    void 绕过审核结论接口被副作用拒绝() {
        long caseId = 造待审核案例("绕过接口的案例");

        assertThatThrownBy(() -> transitions.transit(new TransitCommand(
                CaseStateMachines.OBJECT_TYPE, caseId, CaseStateMachines.FIELD_CASE_STATE,
                CaseStateMachines.ACTION_AUDIT_PASS, null, null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("没有审核人");

        assertThat(cases.get(caseId).getCaseState())
                .describedAs("整笔事务回滚，不能留下一条没有审核人的已上架案例")
                .isEqualTo("待审核");
    }

    @Test
    @DisplayName("需求 12.3 第 15 项：下架修改后再次审核通过，上架时间保持首次的值")
    void 上架时间只写一次() {
        long caseId = 造待审核案例("会下架重上的案例");
        String reviewerNo = 造人员("重复审核人", "AI 学院");
        application.recordAudit(caseId, new CaseAuditForm(reviewerNo, LocalDate.now(),
                null, CaseEnums.AUDIT_PASS, null));
        var 首次上架 = cases.get(caseId).getPublishedAt();

        transitions.transit(new TransitCommand(CaseStateMachines.OBJECT_TYPE, caseId,
                CaseStateMachines.FIELD_CASE_STATE, "UNPUBLISH_FOR_REVISION", null, null));
        提交审核(caseId);
        application.recordAudit(caseId, new CaseAuditForm(reviewerNo, LocalDate.now(),
                null, CaseEnums.AUDIT_PASS, null));

        assertThat(cases.get(caseId).getPublishedAt())
                .describedAs("重算会把上架周期变成「最后一次上架用了多久」")
                .isEqualTo(首次上架);
    }

    // -------------------------------------------------------------------------
    // 编辑与查询（需求 12.3、12.7）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("规则 C2：不校验「上架前正文必填」，正文留空照样能存能上架")
    void 正文为空不阻断() {
        long caseId = 造待审核案例("没有正文的历史案例");
        CaseListItem before = cases.get(caseId);

        cases.update(caseId, 表单(before, null), before.getVersion());

        application.recordAudit(caseId, new CaseAuditForm(造人员("宽松审核人", "AI 学院"),
                LocalDate.now(), null, CaseEnums.AUDIT_PASS, null));
        assertThat(cases.get(caseId).getCaseState())
                .describedAs("硬校验会把补录的历史案例整批挡在门外")
                .isEqualTo("已上架");
    }

    @Test
    @DisplayName("规则 K1：版本号对不上时返回 CONCURRENT_MODIFIED，提示里带最后修改时间")
    void 乐观锁冲突() {
        long caseId = 造待审核案例("会撞车的案例");
        CaseListItem before = cases.get(caseId);

        cases.update(caseId, 表单(before, "第一个人改的"), before.getVersion());

        assertThatThrownBy(() -> cases.update(caseId, 表单(before, "第二个人改的"), before.getVersion()))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.CONCURRENT_MODIFIED))
                .hasMessageContaining("最后修改");
    }

    @Test
    @DisplayName("需求 12.3 第 6 项：应用领域必须取自作战单元字典")
    void 应用领域取自字典() {
        long caseId = 造待审核案例("领域要校验的案例");
        CaseListItem before = cases.get(caseId);

        assertThatThrownBy(() -> cases.update(caseId, new CaseForm(before.getCaseName(),
                "客服中心", List.of(), List.of("凭空捏造的领域"), before.getOwnerNo(),
                List.of(), null, null), before.getVersion()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("应用领域只能是");
    }

    @Test
    @DisplayName("需求 12.7：按状态、领域、精品标注与关键字筛选，四项互动计数随行返回")
    void 看板筛选与互动计数() {
        long caseId = 造待审核案例("能被搜到的案例");
        CaseListItem before = cases.get(caseId);
        cases.update(caseId, new CaseForm(before.getCaseName(), "客服中心", List.of(),
                List.of(启用中的作战单元编码()), before.getOwnerNo(), List.of(CaseEnums.MARK_TOP),
                "正文内容", null), before.getVersion());

        CaseQuery query = new CaseQuery();
        query.setKeyword("能被搜到");
        query.setQualityMark(CaseEnums.MARK_TOP);
        query.setDomainCode(启用中的作战单元编码());
        query.setCaseState("待审核");

        PageResult<CaseListItem> page = cases.page(query);
        assertThat(page.records()).extracting(CaseListItem::getId).contains(caseId);
        assertThat(page.records().get(0).getViewCount()).isZero();
        assertThat(page.records().get(0).getAvgReadSeconds())
                .describedAs("没人打开过是「无数据」而不是 0 秒，设计规范 3.3")
                .isNull();
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private CaseForm 表单(CaseListItem current, String content) {
        return new CaseForm(current.getCaseName(), "客服中心", List.of(),
                List.of(启用中的作战单元编码()), current.getOwnerNo(), List.of(), content, null);
    }

    /** 造一条已经走到「待审核」的案例：课程达精品 → 开始整理 → 提交审核。 */
    private long 造待审核案例(String courseName) {
        long caseId = 造整理中案例(courseName);
        提交审核(caseId);
        return caseId;
    }

    private long 造整理中案例(String courseName) {
        long courseId = 造推广中的课程(courseName, 造人员(courseName + "负责人", "客服中心"));
        标注达精品(courseId);
        long caseId = cases.findIdByCourse(courseId);
        transitions.transit(new TransitCommand(CaseStateMachines.OBJECT_TYPE, caseId,
                CaseStateMachines.FIELD_CASE_STATE, "START_ORGANIZE", null, null));
        return caseId;
    }

    private void 提交审核(long caseId) {
        transitions.transit(new TransitCommand(CaseStateMachines.OBJECT_TYPE, caseId,
                CaseStateMachines.FIELD_CASE_STATE, "SUBMIT_AUDIT", null, null));
    }

    private void 标注达精品(long courseId) {
        标注达精品(courseId, true);
    }

    /**
     * 把课程推到「精品案例」。第二次调用时先用 SQL 把主状态拨回「推广」——现实中这条路径是
     * 课程回退后再次标注，而这里只关心 {@code CREATE_CASE} 会不会建出第二个案例。
     */
    private void 标注达精品(long courseId, boolean first) {
        if (!first) {
            jdbc.update("UPDATE biz_course SET main_state = ? WHERE id = ?",
                    CourseStateMachines.MAIN_PROMOTION, courseId);
        }
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, courseId,
                CourseStateMachines.FIELD_MAIN_STATE, "MARK_QUALIFIED", null, null));
    }

    /**
     * 直接用 SQL 造一门停在「推广」的课程。
     *
     * <p>不走 8 次状态转换把它推上来：本类测的是案例侧，课程的完整流转由 A 段的测试盯着，
     * 在这里重跑一遍只会让每个用例慢上一截，且课程流程一改这里就跟着红。
     */
    private long 造推广中的课程(String courseName, String ownerNo) {
        return jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                        initiated_date, expect_publish_date, validity_period,
                                        initiation_no, main_state, created_by)
                VALUES (?, ?, '内部端到端课程', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '长期有效', ?, ?, 'operator')
                RETURNING id
                """, Long.class, "KC" + System.nanoTime(), courseName, 启用中的作战单元编码(),
                ownerNo, "LI" + System.nanoTime(), CourseStateMachines.MAIN_PROMOTION);
    }

    private String 初始状态() {
        return CaseStateMachines.caseState().transitions().stream()
                .filter(t -> t.from() == null)
                .findFirst()
                .orElseThrow()
                .to();
    }

    private String 启用中的作战单元编码() {
        return jdbc.queryForObject("""
                SELECT item_code FROM dict_item
                 WHERE dict_type = '作战单元' AND enabled = TRUE AND deleted = FALSE
                 ORDER BY id LIMIT 1
                """, String.class);
    }

    private String 造人员(String name, String dept) {
        String no = "E" + System.nanoTime();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, ?, '两者', '在职', 'operator')
                """, no, name, dept);
        return no;
    }
}
