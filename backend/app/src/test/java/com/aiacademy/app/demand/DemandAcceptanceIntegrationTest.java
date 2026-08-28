package com.aiacademy.app.demand;

import com.aiacademy.app.application.DemandApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.demand.domain.DemandAcceptanceForm;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandReviewForm;
import com.aiacademy.business.demand.service.DemandAcceptanceService;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 交付、业务验收与归档（阶段 2 B-3 批，需求 5.2.5）。
 *
 * <p>覆盖的四件事都出现在验收点 A1-8 里：交付后自动置「待验收」、未验收通过点归档被拒、
 * 验收通过后可归档、验收不通过按出口退回。前三件是二值的；第四件在出口二上因文档冲突暂缺，
 * 这里把「暂缺」也断言下来（D-13），免得日后有人以为它一直是自动的。
 */
class DemandAcceptanceIntegrationTest extends IntegrationTest {

    @Autowired
    private DemandService demands;

    @Autowired
    private DemandAcceptanceService acceptances;

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
        employeeNo = 造人员("验收相关人");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("需求 5.2.5 第 1 行：一次「标记交付使用」推进两个状态机，交付时间只写一次")
    void 标记交付使用() {
        long id = 已发布解决方案的需求("交付");

        application.markDelivered(id, demands.get(id).getVersion());

        var demand = demands.get(id);
        assertThat(demand.getDeliveryMark()).isEqualTo("已交付");
        assertThat(demand.getAcceptanceState())
                .describedAs("验收点 A1-8：交付使用后业务验收状态自动置「待验收」")
                .isEqualTo("待验收");
        assertThat(demand.getDeliveredAt()).isEqualTo(LocalDate.now());

        assertThat(流转日志(id))
                .describedAs("两个状态机各写一条流转日志，缺一条则 15.2 的时点取不到")
                .contains("需求交付标记|已交付", "业务验收状态|待验收");
    }

    @Test
    @DisplayName("C9 例外之一：未验收通过时归档被硬阻断，状态与归档时间一起回滚")
    void 未验收通过不能归档() {
        long id = 已交付的需求("未验收就归档");

        assertThatThrownBy(() -> 交付标记(id, "ARCHIVE"))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED))
                .hasMessage("该需求尚未业务验收通过");

        var demand = demands.get(id);
        assertThat(demand.getDeliveryMark())
                .describedAs("副作用抛异常时整笔事务回滚，状态列不能停在「已归档」")
                .isEqualTo("已交付");
        assertThat(demand.getArchivedAt()).isNull();
    }

    @Test
    @DisplayName("需求 5.2.5 第 2 行 + 终态：验收通过后可归档，归档时间落库")
    void 验收通过后归档() {
        long id = 已交付的需求("验收通过");

        long acceptanceId = application.recordAcceptanceConclusion(id,
                结论表单(DemandEnums.ACCEPTANCE_PASS, "工具已在班组日常使用"));

        var accepted = demands.get(id);
        assertThat(accepted.getAcceptanceState()).isEqualTo("验收通过");
        assertThat(accepted.getAcceptorName()).isEqualTo("王班长");
        assertThat(accepted.getAcceptedAt()).isEqualTo(LocalDate.now());
        assertThat(accepted.getAcceptanceOpinion()).isEqualTo("工具已在班组日常使用");
        assertThat(acceptances.listByDemand(id)).singleElement().satisfies(record -> {
            assertThat(record.id()).isEqualTo(acceptanceId);
            assertThat(record.roundNo()).isEqualTo(1);
            assertThat(record.acceptanceResult()).isEqualTo(DemandEnums.ACCEPTANCE_PASS);
        });

        交付标记(id, "ARCHIVE");

        var archived = demands.get(id);
        assertThat(archived.getDeliveryMark()).isEqualTo("已归档");
        assertThat(archived.getArchivedAt()).isEqualTo(LocalDate.now());
    }

    @Test
    @DisplayName("REVERT_BY_OUTLET：出口一验收不通过时解决方案状态退回「已输出」")
    void 出口一验收不通过退回() {
        long id = 已交付的需求("出口一退回");

        application.recordAcceptanceConclusion(id,
                结论表单(DemandEnums.ACCEPTANCE_REJECT, "生成的话术不能直接用"));

        var demand = demands.get(id);
        assertThat(demand.getAcceptanceState()).isEqualTo("验收不通过");
        assertThat(demand.getSolutionState())
                .describedAs("需求 5.2.5 第 3 行：出口一退到解决方案状态=已输出")
                .isEqualTo("已输出");
        assertThat(流转日志(id))
                .describedAs("退回也是状态变更，必须留痕")
                .contains("解决方案状态|已输出");
    }

    @Test
    @DisplayName("D-13：出口二验收不通过暂不自动退回——5.2.4 转换表没有「已上线 → 开发中」")
    void 出口二验收不通过不退回() {
        long id = 已上线的需求("出口二退回");
        application.markDelivered(id, demands.get(id).getVersion());

        application.recordAcceptanceConclusion(id,
                结论表单(DemandEnums.ACCEPTANCE_REJECT, "上线后核心场景跑不通"));

        var demand = demands.get(id);
        assertThat(demand.getAcceptanceState()).isEqualTo("验收不通过");
        assertThat(demand.getDevState())
                .describedAs("擅自退到「优化中」是另一个业务含义，状态写错后流转日志无法事后区分")
                .isEqualTo("已上线");
    }

    @Test
    @DisplayName("需求 5.2.5 第 4 行：重新提交验收轮次 +1，可反复验收不设上限")
    void 反复验收() {
        long id = 已交付的需求("反复验收");
        application.recordAcceptanceConclusion(id, 结论表单(DemandEnums.ACCEPTANCE_REJECT, "首轮不通过"));

        验收状态(id, "RESUBMIT_ACCEPTANCE");

        var resubmitted = demands.get(id);
        assertThat(resubmitted.getAcceptanceState()).isEqualTo("待验收");
        assertThat(resubmitted.getAcceptanceRound())
                .describedAs("主表数的是重新提交次数，比验收记录的轮次小 1")
                .isEqualTo(1);

        application.recordAcceptanceConclusion(id, 结论表单(DemandEnums.ACCEPTANCE_PASS, "二轮通过"));

        assertThat(acceptances.listByDemand(id))
                .describedAs("列表按轮次倒序，两轮各自留档、后一轮不覆盖前一轮")
                .extracting(record -> record.roundNo() + "|" + record.acceptanceResult())
                .containsExactly("2|" + DemandEnums.ACCEPTANCE_PASS, "1|" + DemandEnums.ACCEPTANCE_REJECT);
        assertThat(demands.get(id).getAcceptanceState()).isEqualTo("验收通过");
    }

    @Test
    @DisplayName("RECORD_ACCEPTANCE：绕过验收结论接口直接推状态会被复核拦下")
    void 没有验收人不能到验收通过() {
        long id = 已交付的需求("绕过接口");

        assertThatThrownBy(() -> 验收状态(id, DemandStateMachines.ACTION_RECORD_ACCEPTANCE_PASS))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("没有验收人");

        assertThat(demands.get(id).getAcceptanceState())
                .describedAs("「验收通过但没有验收人」的需求已经可以归档了，等于验收环节从未发生")
                .isEqualTo("待验收");
    }

    @Test
    @DisplayName("K1：录入验收结论带过期版本号时报 CONCURRENT_MODIFIED，验收记录不会留下")
    void 录入结论的乐观锁() {
        long id = 已交付的需求("并发验收");
        int staleVersion = demands.get(id).getVersion();
        demands.update(id, 表单("并发验收（改过名字）"), staleVersion);

        assertThatThrownBy(() -> application.recordAcceptanceConclusion(id,
                new DemandAcceptanceForm("王班长", LocalDate.now(),
                        DemandEnums.ACCEPTANCE_PASS, "意见", staleVersion)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.CONCURRENT_MODIFIED));

        assertThat(acceptances.listByDemand(id))
                .describedAs("写字段与建记录同事务，前者失败时后者不该留下一条孤儿验收记录")
                .isEmpty();
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    /** 出口一走到「已发布」，即需求 5.2.5 前置表第 1 行的可交付状态。 */
    private long 已发布解决方案的需求(String name) {
        long id = application.register(表单(name + System.nanoTime()));
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_REVIEW_STATE, "START_REVIEW", null, null));
        application.recordReviewConclusion(id, new DemandReviewForm(LocalDate.now(),
                "线下评审会同意", "先做最小闭环", DemandEnums.OUTLET_SOLUTION, null));
        application.createSolution(id, name + " 的解决方案", demands.get(id).getVersion());
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_SOLUTION_STATE, "PUBLISH_SOLUTION", null, null));
        return id;
    }

    /** 出口二走到「已上线」。 */
    private long 已上线的需求(String name) {
        long id = application.register(表单(name + System.nanoTime()));
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_REVIEW_STATE, "START_REVIEW", null, null));
        application.recordReviewConclusion(id, new DemandReviewForm(LocalDate.now(),
                "线下评审会同意", "造工具", DemandEnums.OUTLET_DEVELOPMENT, null));
        for (String action : List.of("INITIATE", "ENQUEUE", "START_DEVELOP", "GO_LIVE")) {
            transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                    DemandStateMachines.FIELD_DEV_STATE, action, null, null));
        }
        return id;
    }

    private long 已交付的需求(String name) {
        long id = 已发布解决方案的需求(name);
        application.markDelivered(id, demands.get(id).getVersion());
        return id;
    }

    private void 验收状态(long id, String action) {
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_ACCEPTANCE_STATE, action, null, null));
    }

    private void 交付标记(long id, String action) {
        transitions.transit(new TransitCommand(DemandStateMachines.OBJECT_TYPE, id,
                DemandStateMachines.FIELD_DELIVERY_MARK, action, null, null));
    }

    private List<String> 流转日志(long id) {
        return jdbc.queryForList("""
                SELECT state_field || '|' || to_state FROM audit_state_log
                 WHERE object_type = ? AND object_id = ? ORDER BY id
                """, String.class, DemandStateMachines.OBJECT_TYPE, id);
    }

    private DemandAcceptanceForm 结论表单(String result, String opinion) {
        return new DemandAcceptanceForm("王班长", LocalDate.now(), result, opinion, null);
    }

    private DemandForm 表单(String name) {
        return new DemandForm(name, "COURSE", employeeNo, employeeNo,
                LocalDate.now().minusDays(10), LocalDate.now().plusDays(30),
                name + " 的业务问题与场景", "部门提出", "效率提升", "P1（重要）");
    }

    private String 造人员(String name) {
        String no = "E" + System.nanoTime() % 100000000L;
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, '数字化部', '学员', '在职', 'operator')
                """, no, name);
        return no;
    }
}
