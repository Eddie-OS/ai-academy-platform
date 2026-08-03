package com.aiacademy.app.demand;

import com.aiacademy.app.application.DemandApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandListItem;
import com.aiacademy.business.demand.domain.DemandQuery;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 需求主表的读写（阶段 2 B-1 批）。
 *
 * <p>用真实 PostgreSQL：编号流水靠 {@code substring(demand_no from 9)::INT} 与咨询锁生成，
 * 逻辑删除靠部分索引，这些在内存库上跑不出真实结论。
 */
class DemandCrudIntegrationTest extends IntegrationTest {

    @Autowired
    private DemandService demands;

    @Autowired
    private DemandApplicationService application;

    @Autowired
    private JdbcTemplate jdbc;

    private String ownerNo;

    private String proposerNo;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
        ownerNo = 造人员("需求负责人", "数字化部");
        proposerNo = 造人员("需求提出人", "客服中心");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 登记
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 8.3.1 第 1 项：需求编号是 XQ + 年月 + 4 位流水，且逐条递增")
    void 需求编号规则() {
        String first = demands.get(application.register(表单("编号规则 A"))).getDemandNo();
        String second = demands.get(application.register(表单("编号规则 B"))).getDemandNo();

        String yearMonth = LocalDate.now().toString().substring(0, 7).replace("-", "");
        assertThat(first).matches("XQ" + yearMonth + "\\d{4}");
        assertThat(Integer.parseInt(second.substring(8)))
                .describedAs("流水必须递增，重号会撞上 uk_demand_no")
                .isEqualTo(Integer.parseInt(first.substring(8)) + 1);
    }

    @Test
    @DisplayName("E1-2：登记要留下「（空）→ 待评审」的流转日志与 last_state_changed_at")
    void 登记补记初始流转() {
        long id = application.register(表单("初始流转"));

        Map<String, Object> log = jdbc.queryForMap("""
                SELECT from_state, to_state, state_field FROM audit_state_log
                 WHERE object_type = 'DEMAND' AND object_id = ?
                """, id);
        assertThat(log.get("from_state"))
                .describedAs("起点没有时间戳，需求 15.2 的需求处理周期就少一条数据，且事后无法补齐")
                .isNull();
        assertThat(log.get("to_state")).isEqualTo("待评审");
        assertThat(log.get("state_field")).isEqualTo(DemandStateMachines.FIELD_REVIEW_STATE);

        assertThat(demands.get(id).getLastStateChangedAt()).isNotNull();
    }

    @Test
    @DisplayName("需求 8.3.1 第 5 项：提出人部门随提出人自动带出，存的是快照文本")
    void 提出人部门自动带出() {
        long id = application.register(表单("部门带出"));

        assertThat(demands.get(id).getProposerDept()).isEqualTo("客服中心");

        // 提出人调岗后，这条需求当时归属哪个部门不应跟着变
        jdbc.update("UPDATE org_employee SET dept_name = '战略部' WHERE employee_no = ?", proposerNo);
        assertThat(demands.get(id).getProposerDept())
                .describedAs("快照而不是每次 JOIN：调岗不该改写历史需求的归属部门")
                .isEqualTo("客服中心");
    }

    @Test
    @DisplayName("需求 8.3.1 第 4／6 项：提出人与负责人必须在人员台账里")
    void 人员必须来自台账() {
        DemandForm form = new DemandForm("野工号", "COURSE", "NOT_EXISTS", ownerNo,
                LocalDate.now(), LocalDate.now().plusDays(30), "描述", null, null, null);

        assertThatThrownBy(() -> application.register(form))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode()).isEqualTo(ErrorCode.PARAM_INVALID))
                .hasMessageContaining("需求提出人");
    }

    @Test
    @DisplayName("需求 8.3.1 第 11～13 项：来源／类型／优先级是固定枚举，取值不在表里就拒绝")
    void 字段枚举校验() {
        DemandForm form = new DemandForm("枚举校验", "COURSE", proposerNo, ownerNo,
                LocalDate.now(), LocalDate.now().plusDays(30), "描述", "老板说的", null, null);

        assertThatThrownBy(() -> application.register(form))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("需求来源只能是");
    }

    // -------------------------------------------------------------------------
    // 编辑与并发
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("C6：改一个错别字只动 updated_at，不动 last_state_changed_at（红灯不该因此消失）")
    void 编辑不影响停滞判定() {
        long id = application.register(表单("停滞判定"));
        var before = demands.get(id);

        demands.update(id, 表单("停滞判定（改过名字）"), before.getVersion());

        var after = demands.get(id);
        assertThat(after.getDemandName()).isEqualTo("停滞判定（改过名字）");
        assertThat(after.getLastStateChangedAt()).isEqualTo(before.getLastStateChangedAt());
        assertThat(after.getVersion()).isEqualTo(before.getVersion() + 1);
    }

    @Test
    @DisplayName("K1：版本号过期时报 CONCURRENT_MODIFIED，文案要说明是被他人改的")
    void 乐观锁冲突() {
        long id = application.register(表单("并发编辑"));
        int staleVersion = demands.get(id).getVersion();
        demands.update(id, 表单("先到先得"), staleVersion);

        assertThatThrownBy(() -> demands.update(id, 表单("后到的改动"), staleVersion))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.CONCURRENT_MODIFIED))
                .hasMessageContaining("已被他人修改");
    }

    // -------------------------------------------------------------------------
    // 列表
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 8.6：关键字命中需求ID／名称／描述，负责人与提出人姓名随列表带出")
    void 列表筛选() {
        String keyword = "筛选专用" + System.nanoTime();
        long id = application.register(表单(keyword));

        DemandQuery query = new DemandQuery();
        query.setKeyword(keyword);
        PageResult<DemandListItem> page = demands.page(query);

        assertThat(page.total()).isEqualTo(1);
        assertThat(page.records()).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo(id);
            assertThat(item.getOwnerName()).isEqualTo("需求负责人");
            assertThat(item.getProposerName()).isEqualTo("需求提出人");
            assertThat(item.getCourseCount()).isZero();
            assertThat(item.getHasCourse()).isFalse();
            assertThat(item.getCurrentProcessState())
                    .describedAs("还没定分流出口时，「当前处理状态」没有可显示的值")
                    .isNull();
        });

        DemandQuery byOwner = new DemandQuery();
        byOwner.setKeyword(keyword);
        byOwner.setOwnerNo("不存在的工号");
        assertThat(demands.page(byOwner).total()).isZero();
    }

    @Test
    @DisplayName("需求 8.6：按评审状态筛选走 review_state 列，分页总数与记录数一致")
    void 按评审状态筛选() {
        String keyword = "评审状态筛选" + System.nanoTime();
        application.register(表单(keyword));

        String pending = jdbc.queryForObject(
                "SELECT review_state FROM biz_demand WHERE demand_name = ?", String.class, keyword);

        DemandQuery query = new DemandQuery();
        query.setKeyword(keyword);
        query.setReviewState(pending);
        assertThat(demands.page(query).total()).isEqualTo(1);

        query.setReviewState("已评审");
        assertThat(demands.page(query).total()).isZero();
    }

    @Test
    @DisplayName("SEC2：逻辑删除后列表与详情都查不到，行仍在库里")
    void 逻辑删除() {
        String keyword = "待删除" + System.nanoTime();
        long id = application.register(表单(keyword));

        demands.softDelete(id);

        DemandQuery query = new DemandQuery();
        query.setKeyword(keyword);
        assertThat(demands.page(query).total()).isZero();
        assertThat(jdbc.queryForObject("SELECT deleted FROM biz_demand WHERE id = ?", Boolean.class, id))
                .isTrue();
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private DemandForm 表单(String name) {
        return new DemandForm(name, "COURSE", proposerNo, ownerNo,
                LocalDate.now().minusDays(10), LocalDate.now().plusDays(30),
                name + " 的业务问题与场景", "部门提出", "效率提升", "高");
    }

    private String 造人员(String name, String dept) {
        String no = "E" + System.nanoTime() % 100000000L;
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, ?, '学员', '在职', 'operator')
                """, no, name, dept);
        return no;
    }
}
