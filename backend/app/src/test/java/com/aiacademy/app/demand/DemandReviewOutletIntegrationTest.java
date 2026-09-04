package com.aiacademy.app.demand;

import com.aiacademy.app.application.DemandApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandReviewForm;
import com.aiacademy.business.demand.domain.DemandProcessInfoForm;
import com.aiacademy.business.demand.domain.DemandReviewInfoForm;
import com.aiacademy.business.demand.service.DemandReviewService;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 需求评审、分流出口与开发状态的自动字段（阶段 2 B-2 批）。
 *
 * <p>这里验证的三件事都属于「漏掉不报错」的那一类：出口没落库、评审历史被覆盖、
 * 首次上线时间被反复重算——它们都不会让任何请求失败，只会让指标在几个月后对不上。
 */
class DemandReviewOutletIntegrationTest extends IntegrationTest {

    @Autowired
    private DemandService demands;

    @Autowired
    private DemandReviewService reviews;

    @Autowired
    private DemandApplicationService application;

    @Autowired
    private TransitionApplicationService transitions;

    @Autowired
    private JdbcTemplate jdbc;

    private String employeeNo;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
        employeeNo = 造人员("需求相关人");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 评审结论与分流出口
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 5.2.1 第 3 行：录入评审结论一笔写完结论、出口、评审记录与状态")
    void 录入评审结论() {
        long id = 评审中的需求("评审结论");

        long reviewId = application.recordReviewConclusion(id, 结论表单(DemandEnums.OUTLET_DEVELOPMENT));

        var demand = demands.get(id);
        assertThat(demand.getReviewState()).isEqualTo("已评审");
        assertThat(demand.getOutlet()).isEqualTo(DemandEnums.OUTLET_DEVELOPMENT);
        assertThat(demand.getReviewConclusion()).isEqualTo("线下评审会同意立项");

        assertThat(reviews.listByDemand(id)).singleElement().satisfies(review -> {
            assertThat(review.id()).isEqualTo(reviewId);
            assertThat(review.roundNo()).isEqualTo(1);
            assertThat(review.reviewDate()).isEqualTo(LocalDate.now());
        });
    }

    @Test
    @DisplayName("评审信息：评审中保存已评审时结论映射出口并留档")
    void 评审信息录入结论() {
        long id = 评审中的需求("评审信息页");
        application.saveReviewInfo(id, new DemandReviewInfoForm(
                "已评审", DemandEnums.CONCLUSION_DEVELOPMENT,
                "专家建议先做最小闭环", "备注仅本轮", "P0（紧急重要）", null));

        var demand = demands.get(id);
        assertThat(demand.getReviewState()).isEqualTo("已评审");
        assertThat(demand.getOutlet()).isEqualTo(DemandEnums.OUTLET_DEVELOPMENT);
        assertThat(demand.getReviewConclusion()).isEqualTo(DemandEnums.CONCLUSION_DEVELOPMENT);
        assertThat(demand.getReviewOpinion()).isEqualTo("专家建议先做最小闭环");
        assertThat(demand.getReviewRemark()).isEqualTo("备注仅本轮");
        assertThat(demand.getPriority()).isEqualTo("P0（紧急重要）");
        assertThat(reviews.listByDemand(id)).singleElement().satisfies(review -> {
            assertThat(review.reviewConclusion()).isEqualTo(DemandEnums.CONCLUSION_DEVELOPMENT);
            assertThat(review.remark()).isEqualTo("备注仅本轮");
        });
    }

    @Test
    @DisplayName("评审信息：待评审不能直接改为已评审")
    void 评审信息禁止跳过评审中() {
        long id = application.register(表单("跳过评审中"));
        assertThatThrownBy(() -> application.saveReviewInfo(id, new DemandReviewInfoForm(
                "已评审", DemandEnums.CONCLUSION_SOLUTION, "意见", null, null, null)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.ILLEGAL_TRANSITION));
        assertThat(demands.get(id).getReviewState()).isEqualTo("待评审");
        assertThat(reviews.listByDemand(id)).isEmpty();
    }

    @Test
    @DisplayName("评审信息：状态未变只改快照，不新增历史轮次")
    void 评审信息同态只改快照() {
        long id = 评审中的需求("同态快照");
        application.saveReviewInfo(id, new DemandReviewInfoForm(
                "已评审", DemandEnums.CONCLUSION_SOLUTION, "第一轮意见", "第一轮备注", null, null));
        int rounds = reviews.listByDemand(id).size();
        int version = demands.get(id).getVersion();

        application.saveReviewInfo(id, new DemandReviewInfoForm(
                "已评审", DemandEnums.CONCLUSION_SOLUTION, "改过的意见", "改过的备注", "P2（一般）", version));

        assertThat(reviews.listByDemand(id)).hasSize(rounds);
        var demand = demands.get(id);
        assertThat(demand.getReviewOpinion()).isEqualTo("改过的意见");
        assertThat(demand.getReviewRemark()).isEqualTo("改过的备注");
        assertThat(demand.getPriority()).isEqualTo("P2（一般）");
    }

    @Test
    @DisplayName("评审信息：待评审可以开始评审，此时还不写出口、不留历史")
    void 评审信息开始评审() {
        long id = application.register(表单("开始评审页"));
        application.saveReviewInfo(id, new DemandReviewInfoForm(
                "评审中", DemandEnums.CONCLUSION_SOLUTION, "会前意见", null, null, null));

        var demand = demands.get(id);
        assertThat(demand.getReviewState()).isEqualTo("评审中");
        assertThat(demand.getOutlet()).isNull();
        assertThat(demand.getReviewOpinion()).isEqualTo("会前意见");
        assertThat(reviews.listByDemand(id)).isEmpty();
    }

    @Test
    @DisplayName("分流与处理：出口一保存方案名称并一跳到已输出")
    void 分流处理输出解决方案() {
        long id = 评审中的需求("分流方案");
        application.saveReviewInfo(id, new DemandReviewInfoForm(
                "已评审", DemandEnums.CONCLUSION_SOLUTION, "同意走解决方案", null, null, null));

        application.saveProcessInfo(id, new DemandProcessInfoForm(
                DemandEnums.OUTLET_SOLUTION, "合同要素抽取方案", DemandEnums.PROCESS_PENDING_OUTPUT,
                "方案备注", null, null, null, LocalDate.now().plusDays(20),
                null, "验收备忘", DemandEnums.DELIVERY_UNDELIVERED, "尚未交付",
                LocalDate.now().plusDays(25), "https://example.com/solution", null));

        var afterName = demands.get(id);
        assertThat(afterName.getSolutionName()).isEqualTo("合同要素抽取方案");
        assertThat(afterName.getSolutionRemark()).isEqualTo("方案备注");
        assertThat(afterName.getSolutionLink()).isEqualTo("https://example.com/solution");
        assertThat(afterName.getActualFinishDate()).isEqualTo(LocalDate.now().plusDays(25));
        assertThat(afterName.getSolutionState()).isNull();

        application.saveProcessInfo(id, new DemandProcessInfoForm(
                DemandEnums.OUTLET_SOLUTION, "合同要素抽取方案", "已输出",
                "方案备注", null, null, null, null,
                null, null, DemandEnums.DELIVERY_UNDELIVERED, null,
                null, "https://example.com/solution", demands.get(id).getVersion()));

        assertThat(demands.get(id).getSolutionState()).isEqualTo("已输出");
    }

    @Test
    @DisplayName("分流与处理：开发状态不能跳过中间态")
    void 分流处理禁止跳过开发中间态() {
        long id = 评审中的需求("分流开发");
        application.saveReviewInfo(id, new DemandReviewInfoForm(
                "已评审", DemandEnums.CONCLUSION_DEVELOPMENT, "同意开发", null, null, null));

        assertThatThrownBy(() -> application.saveProcessInfo(id, new DemandProcessInfoForm(
                DemandEnums.OUTLET_DEVELOPMENT, null, null, null, "报表开发", "已上线",
                "开发备注", null, null, null, DemandEnums.DELIVERY_UNDELIVERED, null,
                null, null, null)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.ILLEGAL_TRANSITION));
        assertThat(demands.get(id).getDevState()).isNull();
    }

    @Test
    @DisplayName("REQUIRE_OUTLET：绕过评审结论接口直接把状态推到「已评审」会被硬阻断")
    void 没有出口不能到已评审() {
        long id = 评审中的需求("绕过接口");

        assertThatThrownBy(() -> transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, DemandStateMachines.FIELD_REVIEW_STATE,
                DemandStateMachines.ACTION_RECORD_REVIEW_RESULT, null, null)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED))
                .hasMessageContaining("分流出口");

        assertThat(demands.get(id).getReviewState())
                .describedAs("「已评审但没有出口」的需求没有任何可执行动作，运营只会觉得它卡住了")
                .isEqualTo("评审中");
    }

    @Test
    @DisplayName("需求 5.2.1 第 5 行：重新评审清空出口，但不动已经产生的下游状态")
    void 重新评审清空出口() {
        long id = 评审中的需求("重新评审");
        application.recordReviewConclusion(id, 结论表单(DemandEnums.OUTLET_DEVELOPMENT));
        开发状态(id, "INITIATE");

        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_REVIEW_STATE, DemandStateMachines.ACTION_REOPEN_REVIEW,
                null, "线下决定重评"));

        var demand = demands.get(id);
        assertThat(demand.getReviewState()).isEqualTo("评审中");
        assertThat(demand.getOutlet()).isNull();
        assertThat(demand.getDevState())
                .describedAs("状态列的唯一写入者是状态机引擎，在副作用里顺手清掉会产生一次没有流转日志的状态变更")
                .isEqualTo("已立项");
    }

    @Test
    @DisplayName("多轮评审各自留档，第二轮不覆盖第一轮")
    void 多轮评审留档() {
        long id = 评审中的需求("多轮评审");
        application.recordReviewConclusion(id, 结论表单(DemandEnums.OUTLET_SOLUTION));

        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_REVIEW_STATE, DemandStateMachines.ACTION_REOPEN_REVIEW,
                null, null));
        application.recordReviewConclusion(id, new DemandReviewForm(LocalDate.now(),
                "二轮结论：改走造工具", "二轮意见", DemandEnums.OUTLET_DEVELOPMENT, null));

        assertThat(reviews.listByDemand(id))
                .describedAs("列表按轮次倒序，最新一轮在前")
                .extracting(r -> r.roundNo() + "|" + r.reviewConclusion())
                .containsExactly("2|二轮结论：改走造工具", "1|线下评审会同意立项");
        assertThat(demands.get(id).getOutlet())
                .describedAs("主表存最新一轮的值")
                .isEqualTo(DemandEnums.OUTLET_DEVELOPMENT);
    }

    @Test
    @DisplayName("需求 8.3.3 第 22 项：解决方案名称与「输出解决方案」状态一起落库")
    void 输出解决方案() {
        long id = 评审中的需求("解决方案");
        application.recordReviewConclusion(id, 结论表单(DemandEnums.OUTLET_SOLUTION));

        application.createSolution(id, "客服话术生成器使用指引", demands.get(id).getVersion());

        var demand = demands.get(id);
        assertThat(demand.getSolutionState()).isEqualTo("已输出");
        assertThat(demand.getSolutionName()).isEqualTo("客服话术生成器使用指引");
        assertThat(demand.getCurrentProcessState())
                .describedAs("需求 8.6 的「当前处理状态」列：出口一看解决方案状态")
                .isEqualTo("已输出");
    }

    @Test
    @DisplayName("出口一尚未输出方案时，处理状态展示「待输出」")
    void 解决方案未输出时处理状态是待输出() {
        long id = 评审中的需求("待输出展示");
        application.recordReviewConclusion(id, 结论表单(DemandEnums.OUTLET_SOLUTION));

        assertThat(demands.get(id).getSolutionState()).isNull();
        assertThat(demands.get(id).getCurrentProcessState())
                .isEqualTo(DemandEnums.PROCESS_PENDING_OUTPUT);
    }

    @Test
    @DisplayName("需求驳回：处理状态为结束，不激活两组状态字段")
    void 需求驳回处理状态是结束() {
        long id = 评审中的需求("驳回");
        application.recordReviewConclusion(id, 结论表单(DemandEnums.OUTLET_REJECT));

        var demand = demands.get(id);
        assertThat(demand.getOutlet()).isEqualTo(DemandEnums.OUTLET_REJECT);
        assertThat(demand.getCurrentProcessState()).isEqualTo(DemandEnums.PROCESS_ENDED);
        assertThat(demand.getSolutionState()).isNull();
        assertThat(demand.getDevState()).isNull();
    }

    // -------------------------------------------------------------------------
    // 开发状态的三个自动字段（需求 8.3.3 第 25～27 项）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E1：优化上线不重算首次上线时间，最新上线时间与优化次数照常更新")
    void 首次上线只写一次() {
        long id = 评审中的需求("反复优化");
        application.recordReviewConclusion(id, 结论表单(DemandEnums.OUTLET_DEVELOPMENT));
        for (String action : new String[]{"INITIATE", "ENQUEUE", "START_DEVELOP", "GO_LIVE"}) {
            开发状态(id, action);
        }

        assertThat(demands.get(id).getFirstOnlineDate()).isEqualTo(LocalDate.now());
        assertThat(demands.get(id).getOptimizeCount()).isZero();

        // 把首次上线时间改早，模拟一条去年上线的需求；再走一轮优化不应被今天覆盖
        jdbc.update("UPDATE biz_demand SET first_online_date = ?, latest_online_date = ? WHERE id = ?",
                LocalDate.now().minusMonths(8), LocalDate.now().minusMonths(8), id);
        开发状态(id, "START_OPTIMIZE");
        开发状态(id, "OPTIMIZE_GO_LIVE");

        var demand = demands.get(id);
        assertThat(demand.getFirstOnlineDate())
                .describedAs("首次上线时间是需求处理周期的终点，重算会让指标随优化次数越来越大")
                .isEqualTo(LocalDate.now().minusMonths(8));
        assertThat(demand.getLatestOnlineDate()).isEqualTo(LocalDate.now());
        assertThat(demand.getOptimizeCount())
                .describedAs("需求 8.3.3 第 27 项：统计进入「优化中」的次数，不设上限")
                .isEqualTo(1);
        assertThat(demand.getCurrentProcessState()).isEqualTo("已上线");
    }

    @Test
    @DisplayName("K1：录入评审结论带过期版本号时报 CONCURRENT_MODIFIED，评审记录不会留下")
    void 录入结论的乐观锁() {
        long id = 评审中的需求("并发录入");
        int staleVersion = demands.get(id).getVersion();
        demands.update(id, 表单("并发录入（改过名字）"), staleVersion);

        assertThatThrownBy(() -> application.recordReviewConclusion(id,
                new DemandReviewForm(LocalDate.now(), "结论", "意见",
                        DemandEnums.OUTLET_SOLUTION, staleVersion)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.CONCURRENT_MODIFIED));

        assertThat(reviews.listByDemand(id))
                .describedAs("写字段与建记录同事务，前者失败时后者不该留下一条孤儿评审记录")
                .isEmpty();
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private long 评审中的需求(String name) {
        long id = application.register(表单(name + System.nanoTime()));
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_REVIEW_STATE, "START_REVIEW", null, null));
        return id;
    }

    private void 开发状态(long id, String action) {
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_DEV_STATE, action, null, null));
    }

    private DemandReviewForm 结论表单(String outlet) {
        return new DemandReviewForm(LocalDate.now(), "线下评审会同意立项", "建议先做最小闭环",
                outlet, null);
    }

    private DemandForm 表单(String name) {
        return new DemandForm(name, "COURSE", employeeNo, employeeNo,
                LocalDate.now().minusDays(10), LocalDate.now().plusDays(30),
                name + " 的业务问题与场景", "部门提出", "效率提升", "P1（重要）");
    }

    private String 造人员(String name) {
        String no = "E" + System.nanoTime();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, '数字化部', '学员', '在职', 'operator')
                """, no, name);
        return no;
    }
}
