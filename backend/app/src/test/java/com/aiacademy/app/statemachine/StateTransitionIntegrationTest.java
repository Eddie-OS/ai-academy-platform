package com.aiacademy.app.statemachine;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.IllegalTransitionException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.service.StateTransitionService;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 出口准则 <b>E1-2</b>：任意状态变更均自动产生流转日志，且 {@code last_state_changed_at} 被更新。
 * 顺带验证规则 K1（乐观锁）与 K2（防重复提交）。
 *
 * <p>每个测试自己造数据、自己按对象ID断言，不清库：容器在整个测试 JVM 内共用，靠「只数自己那条
 * 对象的日志」比靠 truncate 更不容易在并行执行时互相干扰。
 */
class StateTransitionIntegrationTest extends IntegrationTest {

    @Autowired
    private StateTransitionService transitions;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void 以运营账号操作() {
        // 平时由 OperatorContextFilter 从会话里填；这里手工填，顺带验证平台模块确实是从这里读的
        OperatorContext.set(OperatorAccount.OPS, "10.20.30.40");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("E1-2：需求评审状态变更后，流转日志有一条、last_state_changed_at 被写上、version 自增")
    void 状态变更写日志并更新状态变更时间() {
        long id = 造一条待评审的需求("E1-2-A");
        assertThat(单值("SELECT last_state_changed_at FROM biz_demand WHERE id = " + id)).isNull();

        transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, "需求评审状态", "START_REVIEW", 0, "李四操作"));

        Map<String, Object> demand = jdbc.queryForMap("SELECT * FROM biz_demand WHERE id = " + id);
        assertThat(demand.get("review_state")).isEqualTo("评审中");
        assertThat(demand.get("last_state_changed_at")).isNotNull();
        assertThat(demand.get("version")).isEqualTo(1);

        Map<String, Object> log = jdbc.queryForMap(
                "SELECT * FROM audit_state_log WHERE object_type = 'DEMAND' AND object_id = " + id);
        assertThat(log.get("state_field")).isEqualTo("需求评审状态");
        assertThat(log.get("from_state")).isEqualTo("待评审");
        assertThat(log.get("to_state")).isEqualTo("评审中");
        assertThat(log.get("action_code")).isEqualTo("START_REVIEW");
        assertThat(log.get("account_type")).isEqualTo("OPS");
        assertThat(log.get("remark")).isEqualTo("李四操作");
        assertThat(log.get("changed_at")).isNotNull();
        // 二期一人一账号才写这两列（开发 5.2.4）
        assertThat(log.get("operator_no")).isNull();
        assertThat(log.get("operator_name")).isNull();

        // 双日志不合并（开发 5.2.1）：状态变更只进流转日志，不进操作审计日志
        assertThat(操作审计条数("DEMAND", id)).isZero();
    }

    @Test
    @DisplayName("E1-2：没有 version 列的对象（任务）同样写日志、同样更新 last_state_changed_at")
    void 无乐观锁的对象也满足E1_2() {
        long id = 造一条待处理的任务();

        transitions.transit(TransitCommand.of(TaskStateMachine.OBJECT_TYPE, id, "任务状态", "START"));

        Map<String, Object> task = jdbc.queryForMap("SELECT * FROM sys_task WHERE id = " + id);
        assertThat(task.get("task_state")).isEqualTo("处理中");
        assertThat(task.get("last_state_changed_at")).isNotNull();
        assertThat(流转日志条数("TASK", id)).isEqualTo(1);
    }

    @Test
    @DisplayName("K2：重复提交同一个动作被静默拦下（DUPLICATE_SUBMIT），不写第二条日志")
    void 重复提交不产生第二条日志() {
        long id = 造一条待评审的需求("K2-A");
        transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, "需求评审状态", "START_REVIEW", 0, null));

        assertThatThrownBy(() -> transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, "需求评审状态", "START_REVIEW", 1, null)))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).errorCode())
                .isEqualTo(ErrorCode.DUPLICATE_SUBMIT);

        assertThat(流转日志条数("DEMAND", id)).isEqualTo(1);
    }

    @Test
    @DisplayName("K1：带过期版本号提交报并发冲突，状态与日志都不变")
    void 版本号过期报并发冲突() {
        long id = 造一条待评审的需求("K1-A");
        transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, "需求评审状态", "START_REVIEW", 0, null));

        // 版本号已是 1，另一名运营还拿着 0：这在共享账号下是常态而不是偶发（需求 16.1.2 的强调）
        assertThatThrownBy(() -> transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, "需求评审状态", "RECORD_REVIEW_RESULT", 0, null)))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).errorCode())
                .isEqualTo(ErrorCode.CONCURRENT_MODIFIED);

        assertThat(单值("SELECT review_state FROM biz_demand WHERE id = " + id)).isEqualTo("评审中");
        assertThat(流转日志条数("DEMAND", id)).isEqualTo(1);
    }

    @Test
    @DisplayName("C3：转换表里没有的组合硬阻断，状态不变、不写日志")
    void 非法转换硬阻断() {
        long id = 造一条待评审的需求("C3-A");

        // 「发布解决方案」是解决方案状态的动作，不属于需求评审状态
        assertThatThrownBy(() -> transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, "需求评审状态", "PUBLISH_SOLUTION", 0, null)))
                .isInstanceOf(IllegalTransitionException.class);

        assertThat(单值("SELECT review_state FROM biz_demand WHERE id = " + id)).isEqualTo("待评审");
        assertThat(流转日志条数("DEMAND", id)).isZero();
    }

    @Test
    @DisplayName("对象不存在或已逻辑删除时报 NOT_FOUND，而不是当成「状态为空的新对象」")
    void 对象不存在时报未找到() {
        assertThatThrownBy(() -> transitions.transit(TransitCommand.of(
                DemandStateMachines.OBJECT_TYPE, 99_999_999L, "需求评审状态", "START_REVIEW")))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("AR-6：流转日志写失败时状态变更整体回滚——这是 BEFORE_COMMIT 与 AFTER_COMMIT 的分界线")
    void 日志写失败则状态回滚() {
        long id = 造一条待评审的需求("AR-6-A");

        // remark 列限长 500。给一个 600 字的变更说明，让日志插入在 BEFORE_COMMIT 阶段失败。
        // 若监听器改成 AFTER_COMMIT，状态会留在「评审中」而日志缺失——那正是 E1-2 不允许的结果。
        String 超长说明 = "超".repeat(600);
        assertThatThrownBy(() -> transitions.transit(new TransitCommand(
                DemandStateMachines.OBJECT_TYPE, id, "需求评审状态", "START_REVIEW", 0, 超长说明)))
                .isInstanceOf(Exception.class);

        assertThat(单值("SELECT review_state FROM biz_demand WHERE id = " + id)).isEqualTo("待评审");
        assertThat(单值("SELECT last_state_changed_at FROM biz_demand WHERE id = " + id)).isNull();
        assertThat(流转日志条数("DEMAND", id)).isZero();
    }

    // -------------------------------------------------------------------------
    // 造数与查询
    // -------------------------------------------------------------------------

    private long 造一条待评审的需求(String 标记) {
        return jdbc.queryForObject("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                                        proposed_date, expect_finish_date, description,
                                        review_state, created_by)
                VALUES (?, ?, 'AI_DEMAND', 'E001', 'E002', CURRENT_DATE, CURRENT_DATE + 30,
                        '集成测试用需求', '待评审', 'OPS')
                RETURNING id
                """, Long.class, "DEMAND-" + 标记 + "-" + System.nanoTime(), "集成测试需求 " + 标记);
    }

    private long 造一条待处理的任务() {
        return jdbc.queryForObject("""
                INSERT INTO sys_task (title, task_type, object_type, object_id, due_date,
                                      task_state, derive_type, created_by)
                VALUES ('集成测试任务', '需求评审', 'DEMAND', 1, CURRENT_DATE + 7,
                        '待处理', '系统派生', 'OPS')
                RETURNING id
                """, Long.class);
    }

    private Object 单值(String sql) {
        return jdbc.queryForMap(sql).values().iterator().next();
    }

    private int 流转日志条数(String objectType, long objectId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_state_log WHERE object_type = ? AND object_id = ?",
                Integer.class, objectType, objectId);
    }

    private int 操作审计条数(String objectType, long objectId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_op_log WHERE object_type = ? AND object_id = ?",
                Integer.class, objectType, objectId);
    }
}
