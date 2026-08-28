package com.aiacademy.app.warning;

import com.aiacademy.aggregate.warning.domain.LightColor;
import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.aggregate.warning.domain.WarningObjectKind;
import com.aiacademy.aggregate.warning.service.WarningLightService;
import com.aiacademy.app.application.DemandApplicationService;
import com.aiacademy.app.schedule.WarningLightSnapshotJob;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandQuery;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.people.domain.EmployeeForm;
import com.aiacademy.platform.people.service.EmployeeService;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
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
 * 出口准则 E3-2：三色灯边界 + L1（改错别字红灯不消失）；判定口径为 V-9。
 */
class WarningLightIntegrationTest extends IntegrationTest {

    @Autowired
    private WarningLightService lights;

    @Autowired
    private DemandApplicationService demands;

    @Autowired
    private DemandService demandService;

    @Autowired
    private EmployeeService employees;

    @Autowired
    private WarningLightSnapshotJob snapshotJob;

    @Autowired
    private JdbcTemplate jdbc;

    private String ownerNo;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.3.1");
        ownerNo = 造人员("灯色负责人");
    }

    @AfterEach
    void 清理() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("V-9 边界：剩余 0 天（今天到期）→ 黄灯（需要关注）")
    void 剩余零天黄灯() {
        long id = 造需求(LocalDate.now());
        assertThat(jdbc.queryForObject(
                "SELECT calc_light(?::date, NOW(), 3, 5, FALSE)", String.class, LocalDate.now()))
                .isEqualTo(LightColor.YELLOW.apiCode());

        WarningLightView view = lights.calc(DemandStateMachines.OBJECT_TYPE, id);
        assertThat(view.light()).isEqualTo(LightColor.YELLOW.apiCode());
        assertThat(view.days()).isZero();
    }

    @Test
    @DisplayName("V-9：剩余大于蓝阈值 → 蓝灯（正常运行）；临近 → 黄灯")
    void 余量蓝灯临近黄灯() {
        assertThat(jdbc.queryForObject(
                "SELECT calc_light(?::date, NOW(), 3, 5, FALSE)", String.class,
                LocalDate.now().plusDays(10)))
                .isEqualTo(LightColor.BLUE.apiCode());
        assertThat(jdbc.queryForObject(
                "SELECT calc_light(?::date, NOW(), 3, 5, FALSE)", String.class,
                LocalDate.now().plusDays(2)))
                .isEqualTo(LightColor.YELLOW.apiCode());
    }

    @Test
    @DisplayName("V-9：已逾期 → 红灯，成因为已逾期")
    void 逾期红灯() {
        LocalDate overdue = LocalDate.now().minusDays(2);
        assertThat(jdbc.queryForObject(
                "SELECT calc_light(?::date, NOW(), 3, 5, FALSE)", String.class, overdue))
                .isEqualTo(LightColor.RED.apiCode());

        long id = 造需求(overdue);
        WarningLightView view = lights.calc(DemandStateMachines.OBJECT_TYPE, id);
        assertThat(view.light()).isEqualTo(LightColor.RED.apiCode());
        assertThat(view.reason()).isEqualTo("已逾期");
        assertThat(view.days()).isEqualTo(2);
    }

    @Test
    @DisplayName("E3-2 边界：预计完成时间为空 → 不参与蓝黄，仍可红")
    void 预计为空仍可红() {
        assertThat(jdbc.queryForObject(
                "SELECT calc_light(NULL, NOW() - INTERVAL '10 days', 3, 5, FALSE)", String.class))
                .isEqualTo(LightColor.RED.apiCode());

        assertThat(jdbc.queryForObject(
                "SELECT calc_light(NULL, NOW(), 3, 5, FALSE)", String.class))
                .isEqualTo(LightColor.NONE.apiCode());
    }

    @Test
    @DisplayName("E3-2 边界：停滞与逾期同时满足 → 红（停滞优先，成因=状态停滞）")
    void 停滞优先于逾期() {
        LocalDate overdue = LocalDate.now().minusDays(2);
        assertThat(jdbc.queryForObject(
                "SELECT calc_light(?::date, NOW() - INTERVAL '10 days', 3, 5, FALSE)",
                String.class, overdue))
                .isEqualTo(LightColor.RED.apiCode());

        long id = 造需求(overdue);
        jdbc.update("""
                UPDATE biz_demand SET last_state_changed_at = NOW() - INTERVAL '10 days' WHERE id = ?
                """, id);
        WarningLightView view = lights.calc(DemandStateMachines.OBJECT_TYPE, id);
        assertThat(view.light()).isEqualTo(LightColor.RED.apiCode());
        assertThat(view.reason()).isEqualTo("状态停滞");
    }

    @Test
    @DisplayName("E3-2／L1：改需求名称后 last_state_changed_at 不变，红灯不消失")
    void 改错别字红灯不消失() {
        long id = 造需求(LocalDate.now().plusDays(30));
        jdbc.update("""
                UPDATE biz_demand
                   SET last_state_changed_at = NOW() - INTERVAL '10 days'
                 WHERE id = ?
                """, id);

        WarningLightView before = lights.calc(DemandStateMachines.OBJECT_TYPE, id);
        assertThat(before.light()).isEqualTo(LightColor.RED.apiCode());
        OffsetDateTime stateChanged = jdbc.queryForObject(
                "SELECT last_state_changed_at FROM biz_demand WHERE id = ?",
                OffsetDateTime.class, id);

        demandService.update(id, 表单("改过错别字的需求", LocalDate.now().plusDays(30)),
                demandService.get(id).getVersion());

        assertThat(jdbc.queryForObject(
                "SELECT last_state_changed_at FROM biz_demand WHERE id = ?",
                OffsetDateTime.class, id))
                .isEqualTo(stateChanged);
        assertThat(lights.calc(DemandStateMachines.OBJECT_TYPE, id).light())
                .isEqualTo(LightColor.RED.apiCode());
    }

    @Test
    @DisplayName("列表灯色筛选：light=RED 只返回红灯需求")
    void 列表按灯色筛选() {
        long redId = 造需求(LocalDate.now().plusDays(30));
        jdbc.update("""
                UPDATE biz_demand SET last_state_changed_at = NOW() - INTERVAL '10 days' WHERE id = ?
                """, redId);
        long blueId = 造需求(LocalDate.now().plusDays(30));

        DemandQuery query = new DemandQuery();
        query.setLight(LightColor.RED.apiCode());
        query.setPageSize(200);
        var ids = demandService.page(query).records().stream().map(r -> r.getId()).toList();
        assertThat(ids).contains(redId).doesNotContain(blueId);
    }

    @Test
    @DisplayName("业务改版 V-70：预警范围只剩三类，案例阈值已下线")
    void 预警范围三类不含案例() {
        assertThat(WarningObjectKind.values())
                .extracting(WarningObjectKind::thresholdType)
                .containsExactly("AI需求", "课程", "培训计划");
        assertThatThrownBy(() -> WarningObjectKind.require(CaseStateMachines.OBJECT_TYPE))
                .isInstanceOf(IllegalArgumentException.class);

        // V5_002 逻辑删了阈值行。留着它，calc_light 会照旧给案例算灯，只是没人再读
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM cfg_warning_threshold
                 WHERE object_type = '案例' AND deleted = FALSE
                """, Integer.class)).isZero();
    }

    @Test
    @DisplayName("快照任务写入中文灯色，不抛异常")
    void 快照落库() {
        long id = 造需求(LocalDate.now().plusDays(1)); // V-9：临近 → 黄
        snapshotJob.snapshot();
        String light = jdbc.queryForObject("""
                SELECT light FROM snapshot_warning_light
                 WHERE object_type = ? AND object_id = ?
                """, String.class, DemandStateMachines.OBJECT_TYPE, id);
        assertThat(light).isIn("蓝", "无", "黄", "红");
    }

    private long 造需求(LocalDate expectFinish) {
        return demands.register(表单("灯色测试-" + System.nanoTime(), expectFinish));
    }

    private DemandForm 表单(String name, LocalDate expectFinish) {
        return new DemandForm(name, "COURSE", ownerNo, ownerNo,
                LocalDate.now().minusDays(1), expectFinish,
                name + " 描述", "部门提出", "效率提升", "P0（紧急重要）");
    }

    private String 造人员(String name) {
        String no = "L" + System.nanoTime() % 100000000L;
        employees.create(new EmployeeForm(
                no, name, "AI中心", "工程师", no + "@example.com", "学员", "在职", null));
        return no;
    }
}
