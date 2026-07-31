package com.aiacademy.app.audit;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.people.domain.EmployeeForm;
import com.aiacademy.platform.people.service.EmployeeService;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.service.StateTransitionService;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 出口准则 <b>E1-3</b>：修改非状态字段<b>不</b>产生流转日志、<b>不</b>改
 * {@code last_state_changed_at}。这是需求 C6／L1 的反向验证，开发实施文档专门点名「容易漏测」。
 *
 * <p><b>为什么这条准则值得单独一个测试类：</b>把 {@code last_state_changed_at} 做成「每次更新都刷」
 * 是一个非常自然的实现——加一个 MyBatis 自动填充或一个数据库触发器就完成了，代码更短、看起来更整齐。
 * 它的后果是红灯停滞预警彻底失效：运营改一个错别字，一条停滞了 40 天的需求就变绿了，
 * 而且没有任何报错。这个 bug 只能靠反向测试发现。
 *
 * <p><b>本测试覆盖到哪、没覆盖到哪（如实记录）：</b>
 * <ul>
 *   <li>「改非状态字段不写流转日志」用<b>真实生产代码路径</b>验证：人员台账的新增／修改／删除走
 *       {@link EmployeeService} 与审计切面；</li>
 *   <li>「改非状态字段不动 last_state_changed_at」用一条 UPDATE 语句代表阶段 2 的编辑路径，
 *       因为一期禁止实现任何业务对象的 CRUD，此刻还没有需求编辑服务可调。
 *       <b>它证明不了阶段 2 的实体不会给这一列加自动填充</b>——那条防线要靠 1D 的 ArchUnit 断言，
 *       在这里只能证明数据库层面没有触发器或默认值在偷偷刷它。</li>
 * </ul>
 */
class NonStateEditIntegrationTest extends IntegrationTest {

    @Autowired
    private StateTransitionService transitions;

    @Autowired
    private EmployeeService employees;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.20.30.40");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("E1-3：改需求名称只动 updated_at，last_state_changed_at 与流转日志都不变")
    void 改非状态字段不动状态变更时间() {
        long id = 造一条待评审的需求();
        transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, "需求评审状态", "START_REVIEW", 0, null));

        OffsetDateTime 状态变更时间 = 时间列(id, "last_state_changed_at");
        OffsetDateTime 编辑时间 = 时间列(id, "updated_at");
        assertThat(状态变更时间).isNotNull();

        // 阶段 2 的编辑路径长这样：只改业务字段与 updated_at，不碰状态列
        jdbc.update("""
                UPDATE biz_demand
                   SET demand_name = '改过名字的需求', updated_at = NOW(), updated_by = 'OPS'
                 WHERE id = ?
                """, id);

        assertThat(时间列(id, "last_state_changed_at"))
                .describedAs("改错别字让红灯消失，是 L1 要防的第一号事故")
                .isEqualTo(状态变更时间);
        assertThat(时间列(id, "updated_at"))
                .describedAs("需求 C6 的最后编辑时间该动")
                .isAfter(编辑时间);
        assertThat(流转日志条数("DEMAND", id))
                .describedAs("流转日志只应有那一条 START_REVIEW")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("E1-3：人员台账的修改写操作审计日志、逐字段一行，且完全不进流转日志")
    void 台账修改只写操作审计日志() {
        long id = employees.create(new EmployeeForm(
                "E-" + System.nanoTime(), "张三", "AI中心", "工程师",
                "zhangsan@example.com", "学员", "在职", null));

        assertThat(操作审计("EMPLOYEE", id)).hasSize(1);
        assertThat(操作审计("EMPLOYEE", id).get(0))
                .containsEntry("op_type", "新增")
                .containsEntry("account_type", "OPS")
                .containsEntry("operator_ip", "10.20.30.40");

        employees.update(id, new EmployeeForm(
                null, "张三丰", "AI中心", "高级工程师",
                "zhangsan@example.com", "两者", "在职", null));

        List<Map<String, Object>> 修改行 = 操作审计("EMPLOYEE", id).stream()
                .filter(row -> "修改".equals(row.get("op_type")))
                .toList();
        assertThat(修改行)
                .describedAs("姓名、岗位、人员类型三个字段变了，邮箱与部门没变，因此是三行不是七行")
                .hasSize(3);
        assertThat(修改行).extracting(row -> row.get("field_name"))
                .containsExactlyInAnyOrder("姓名", "岗位", "人员类型");
        assertThat(修改行).filteredOn(row -> "姓名".equals(row.get("field_name")))
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.get("old_value")).isEqualTo("张三");
                    assertThat(row.get("new_value")).isEqualTo("张三丰");
                });

        assertThat(流转日志条数("EMPLOYEE", id))
                .describedAs("人员台账没有状态机，一条流转日志都不该有——两套日志不得合并（开发 5.2.1）")
                .isZero();
    }

    @Test
    @DisplayName("原样保存不写审计日志：记一行「什么都没改」只会淹没真正的变更")
    void 无变化的修改不写日志() {
        EmployeeForm 原样 = new EmployeeForm(
                "E-" + System.nanoTime(), "李四", "AI中心", "工程师",
                "lisi@example.com", "讲师", "在职", null);
        long id = employees.create(原样);

        employees.update(id, 原样);

        assertThat(操作审计("EMPLOYEE", id)).extracting(row -> row.get("op_type"))
                .containsExactly("新增");
    }

    @Test
    @DisplayName("逻辑删除写审计日志，并顺带记下是谁删的（6.1.2：删除也是一次更新）")
    void 逻辑删除留痕() {
        long id = employees.create(new EmployeeForm(
                "E-" + System.nanoTime(), "王五", "AI中心", null, null, "学员", "离职", null));

        employees.delete(id);

        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM org_employee WHERE id = " + id);
        assertThat(row.get("deleted")).isEqualTo(true);
        assertThat(row.get("updated_by")).isEqualTo("OPS");
        assertThat(操作审计("EMPLOYEE", id)).extracting(r -> r.get("op_type"))
                .containsExactly("新增", "删除");
    }

    // -------------------------------------------------------------------------

    private long 造一条待评审的需求() {
        return jdbc.queryForObject("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                                        proposed_date, expect_finish_date, description,
                                        review_state, created_by)
                VALUES (?, 'E1-3 用需求', 'AI_DEMAND', 'E001', 'E002', CURRENT_DATE,
                        CURRENT_DATE + 30, '集成测试用需求', '待评审', 'OPS')
                RETURNING id
                """, Long.class, "DEMAND-E1-3-" + System.nanoTime());
    }

    private OffsetDateTime 时间列(long id, String column) {
        return jdbc.queryForObject(
                "SELECT " + column + " FROM biz_demand WHERE id = ?", OffsetDateTime.class, id);
    }

    private int 流转日志条数(String objectType, long objectId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_state_log WHERE object_type = ? AND object_id = ?",
                Integer.class, objectType, objectId);
    }

    private List<Map<String, Object>> 操作审计(String objectType, long objectId) {
        return jdbc.queryForList(
                "SELECT * FROM audit_op_log WHERE object_type = ? AND object_id = ? ORDER BY id",
                objectType, objectId);
    }
}
