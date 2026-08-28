package com.aiacademy.app.dashboard;

import com.aiacademy.app.application.DashboardOverviewApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.app.web.dto.DashboardOverviewVO;
import com.aiacademy.business.demand.domain.ValueReportForm;
import com.aiacademy.business.demand.service.ValueReportService;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class DashboardOverviewIntegrationTest extends IntegrationTest {

    @Autowired
    private DashboardOverviewApplicationService overview;

    @Autowired
    private ValueReportService values;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void 运营账号() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.3.1");
    }

    @AfterEach
    void 清理() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("overview 含 quantity／efficiency／warnings／value 块且不抛异常")
    void 总看板聚合() {
        String owner = 造人员();
        jdbc.update("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                    proposed_date, expect_finish_date, description, review_state,
                    last_state_changed_at, created_by)
                VALUES (?, '看板红灯需求', 'COURSE', ?, ?, CURRENT_DATE, CURRENT_DATE + 1,
                        '描述', '待评审', NOW() - INTERVAL '10 days', 'OPS')
                """, "XQ" + nano(), owner, owner);

        ValueReportForm form = new ValueReportForm();
        form.setReportPeriod(LocalDate.now().getYear() + "-01");
        form.setEfficiencyGain("审批缩短");
        form.setQualityGain("缺陷下降");
        form.setCostSaving(new BigDecimal("12.5"));
        form.setCostSavingUnit("万元");
        values.create(form);

        DashboardOverviewVO vo = overview.overview();
        assertThat(vo.quantity()).containsKeys(
                "demandTotal", "courseTotal", "coursePublished",
                "lecturerPool", "trainingSession", "caseListed");
        assertThat(vo.cockpits()).containsKeys("demands", "courses", "lecturers", "trainings", "cases");
        assertThat(vo.efficiency()).containsKeys(
                "demandReviewCycle", "courseDevCycle", "firstRoundPassRate",
                "reviewRounds", "casePublishCycle");
        assertThat(vo.efficiencyTrends()).isNotNull();
        assertThat(vo.efficiencyTrends().months()).hasSize(6);
        assertThat(vo.efficiencyTrends().series()).containsKeys(
                "demandReviewCycle", "courseDevCycle", "firstRoundPassRate", "casePublishCycle");
        assertThat(vo.efficiencyTrends().series().get("demandReviewCycle")).hasSize(6);
        assertThat(vo.warnings()).isNotNull();
        assertThat(vo.warnings().healthy() + vo.warnings().blue()
                + vo.warnings().yellow() + vo.warnings().red()).isGreaterThanOrEqualTo(0);
        assertThat(vo.value().efficiencyGainCount()).isGreaterThanOrEqualTo(1);
        assertThat(vo.value().qualityGainCount()).isGreaterThanOrEqualTo(1);
        assertThat(vo.value().costSavingByUnit()).containsKey("万元");
        assertThat(vo.worklist()).isNotNull();
        assertThat(vo.openTasks()).isNotNull();
    }

    private String 造人员() {
        String no = "E" + nano();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, 'AI中心', '两者', '在职', 'OPS')
                """, no, "看板人员" + no);
        return no;
    }

    private static long nano() {
        return System.nanoTime() % 1_000_000_000L;
    }
}
