package com.aiacademy.app.escalation;

import com.aiacademy.app.application.DemandApplicationService;
import com.aiacademy.app.application.EscalationPendingApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.app.web.dto.EscalationPendingVO;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.escalation.domain.EscalationForm;
import com.aiacademy.platform.escalation.domain.EscalationQuery;
import com.aiacademy.platform.escalation.domain.EscalationRecord;
import com.aiacademy.platform.escalation.service.EscalationService;
import com.aiacademy.platform.people.domain.EmployeeForm;
import com.aiacademy.platform.people.service.EmployeeService;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 阶段 4A：催办台账 D1／快照名／待催办清单。
 */
class EscalationIntegrationTest extends IntegrationTest {

    @Autowired
    private EscalationService escalations;

    @Autowired
    private EscalationPendingApplicationService pending;

    @Autowired
    private DemandApplicationService demands;

    @Autowired
    private EmployeeService employees;

    @Autowired
    private JdbcTemplate jdbc;

    private String ownerNo;
    private long demandId;

    @BeforeEach
    void setUp() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.4.1");
        ownerNo = 造人员("催办负责人");
        demandId = 造逾期需求();
    }

    @AfterEach
    void tearDown() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("E4-3：24 小时内二次标记返回 URGE_TOO_FREQUENT；force 后写入第二条")
    void 防重复与强制() {
        EscalationForm form = form(demandId, "智能质检助手-旧名");
        long first = escalations.mark(form);
        assertThat(first).isPositive();

        assertThatThrownBy(() -> escalations.mark(form))
                .isInstanceOf(BizException.class)
                .extracting(ex -> ((BizException) ex).errorCode())
                .isEqualTo(ErrorCode.URGE_TOO_FREQUENT);

        // message 直接贴到二次确认弹窗上（开发 7.2），所以里面的时间要是本地时区、
        // 到分不到秒（设计规范 3.3）。拼 OffsetDateTime.toString() 会漏出 2026-08-27T08:39:24.605868Z
        assertThatThrownBy(() -> escalations.mark(form))
                .isInstanceOf(BizException.class)
                .hasMessageMatching(".*\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2} 催办过.*");

        EscalationForm forced = new EscalationForm(
                form.objectType(), form.objectId(), form.objectName(), form.ownerNo(), form.ownerName(),
                form.escalateType(), form.channelNote(), form.remark(), form.escalatedAt(),
                form.processNode(), form.light(), form.source(), form.content(), true);
        long second = escalations.mark(forced);
        assertThat(second).isNotEqualTo(first);

        EscalationQuery q = new EscalationQuery();
        q.setObjectType(DemandStateMachines.OBJECT_TYPE);
        q.setObjectId(demandId);
        assertThat(escalations.page(q).total()).isEqualTo(2);
        assertThat(escalations.page(q).records())
                .extracting(EscalationRecord::escalatedAt)
                .isSortedAccordingTo((a, b) -> b.compareTo(a));
    }

    @Test
    @DisplayName("E4-3：改需求名后历史台账仍显示写入时快照名")
    void 台账名称快照() {
        escalations.mark(form(demandId, "催办时的旧名称"));
        jdbc.update("UPDATE biz_demand SET demand_name = ? WHERE id = ?", "改名后的新名称", demandId);

        EscalationQuery q = new EscalationQuery();
        q.setKeyword("催办时的旧名称");
        EscalationRecord row = escalations.page(q).records().stream()
                .filter(r -> r.objectId() == demandId)
                .findFirst()
                .orElseThrow();
        assertThat(row.objectName()).isEqualTo("催办时的旧名称");
    }

    @Test
    @DisplayName("E4-1：待催办清单按负责人分组且含逾期需求")
    void 待催办清单分组() {
        EscalationPendingVO vo = pending.build();
        assertThat(vo.cycleStart()).isNotBlank();
        assertThat(vo.groups()).anySatisfy(g -> {
            assertThat(g.ownerNo()).isEqualTo(ownerNo);
            assertThat(g.items()).anyMatch(i -> i.objectId() == demandId);
            assertThat(g.dimensions().demands().yellow()
                    + g.dimensions().demands().red()
                    + g.dimensions().demands().blue()).isGreaterThanOrEqualTo(1);
        });
    }

    private EscalationForm form(long id, String name) {
        return new EscalationForm(
                DemandStateMachines.OBJECT_TYPE, id, name, ownerNo, "催办负责人",
                "逾期", "企业微信", null, OffsetDateTime.now().minusHours(1),
                "待评审", "YELLOW", "系统生成清单",
                "请尽快处理", false);
    }

    private long 造逾期需求() {
        return demands.register(new DemandForm(
                "催办测试需求-" + System.nanoTime(), "COURSE", ownerNo, ownerNo,
                LocalDate.now().minusDays(1), LocalDate.now().minusDays(3),
                "催办测试描述", "部门提出", "效率提升", "P0（紧急重要）"));
    }

    private String 造人员(String name) {
        String no = "E4" + System.nanoTime() % 100000000L;
        employees.create(new EmployeeForm(
                no, name, "AI中心", "工程师", no + "@example.com", "学员", "在职", null));
        return no;
    }
}
