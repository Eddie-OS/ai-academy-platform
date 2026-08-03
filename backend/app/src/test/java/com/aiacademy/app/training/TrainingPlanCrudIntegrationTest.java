package com.aiacademy.app.training;

import com.aiacademy.app.application.TrainingApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.business.training.domain.TrainingPlanForm;
import com.aiacademy.business.training.domain.TrainingPlanListItem;
import com.aiacademy.business.training.domain.TrainingPlanQuery;
import com.aiacademy.business.training.service.TrainingPlanService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 培训计划的读写与状态（阶段 2 C-1 批，需求 11.3、11.8、5.7）。
 *
 * <p>用真实 PostgreSQL：编号流水靠 {@code substring(plan_no from 9)::INT} 与咨询锁生成，
 * 实际场次数靠子查询实时 COUNT，实际完成时间靠 {@code COALESCE} 只写一次——这些在内存库上
 * 跑不出真实结论。
 */
class TrainingPlanCrudIntegrationTest extends TrainingTestBase {

    @Autowired
    private TrainingPlanService plans;

    @Autowired
    private TrainingApplicationService application;

    @Autowired
    private TransitionApplicationService transitions;

    // -------------------------------------------------------------------------
    // 新建
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 11.3 第 1 项：计划编号是 JH + 年月 + 3 位流水，且逐条递增")
    void 计划编号规则() {
        long courseId = 造课程("编号规则");
        String first = plans.get(application.createPlan(计划表单("编号 A", courseId))).getPlanNo();
        String second = plans.get(application.createPlan(计划表单("编号 B", courseId))).getPlanNo();

        String yearMonth = LocalDate.now().toString().substring(0, 7).replace("-", "");
        assertThat(first).matches("JH" + yearMonth + "\\d{3}");
        assertThat(Integer.parseInt(second.substring(8)))
                .describedAs("流水必须递增，重号会撞上 uk_training_plan_no，还会顺着场次号扩散到签到导入模板")
                .isEqualTo(Integer.parseInt(first.substring(8)) + 1);
    }

    @Test
    @DisplayName("C4／C5：新建要留下「（空）→ 待执行」的流转日志与 last_state_changed_at")
    void 新建补记初始流转() {
        long id = application.createPlan(计划表单("初始流转", 造课程("初始流转")));

        Map<String, Object> log = jdbc.queryForMap("""
                SELECT from_state, to_state, state_field FROM audit_state_log
                 WHERE object_type = ? AND object_id = ?
                """, TrainingStateMachines.PLAN_OBJECT_TYPE, id);
        assertThat(log.get("from_state")).isNull();
        assertThat(log.get("to_state")).isEqualTo("待执行");
        assertThat(log.get("state_field")).isEqualTo(TrainingStateMachines.FIELD_PLAN_STATE);

        assertThat(plans.get(id).getLastStateChangedAt()).isNotNull();
    }

    @Test
    @DisplayName("需求 11.3 第 3 项：关联课程必须存在")
    void 关联课程必须存在() {
        TrainingPlanForm form = 计划表单("野课程", 999_999_999L);

        assertThatThrownBy(() -> application.createPlan(form))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode()).isEqualTo(ErrorCode.PARAM_INVALID))
                .hasMessageContaining("关联课程不存在");
    }

    @Test
    @DisplayName("需求 11.3 第 3 项：课程尚未发布也能建计划——那项校验 V1.2 移到了场次创建时")
    void 未发布课程可以先排计划() {
        long courseId = 造课程("还在开发的课", "开发");

        long id = application.createPlan(计划表单("提前排的计划", courseId));

        assertThat(plans.get(id).getCourseId()).isEqualTo(courseId);
    }

    @Test
    @DisplayName("需求 11.3 第 4 项：培训负责人必须在人员台账里")
    void 负责人必须来自台账() {
        long courseId = 造课程("负责人校验");
        TrainingPlanForm form = new TrainingPlanForm("野负责人", courseId, "NOT_EXISTS",
                "全体", LocalDate.now(), LocalDate.now().plusDays(10), 1, null);

        assertThatThrownBy(() -> application.createPlan(form))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("培训负责人");
    }

    @Test
    @DisplayName("计划结束日期不能早于开始日期——它是三色灯的判定基准，倒挂会算出无意义的逾期天数")
    void 日期区间不能倒挂() {
        long courseId = 造课程("日期倒挂");
        TrainingPlanForm form = new TrainingPlanForm("倒挂", courseId, ownerNo, "全体",
                LocalDate.now(), LocalDate.now().minusDays(1), 1, null);

        assertThatThrownBy(() -> application.createPlan(form))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode()).isEqualTo(ErrorCode.PARAM_INVALID))
                .hasMessageContaining("结束日期");
    }

    // -------------------------------------------------------------------------
    // 编辑与删除
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("C6：改一个错别字只动 updated_at，不动 last_state_changed_at（红灯不该因此消失）")
    void 编辑不影响停滞判定() {
        long courseId = 造课程("编辑");
        long id = application.createPlan(计划表单("停滞判定", courseId));
        var before = plans.get(id);

        application.updatePlan(id, 计划表单("停滞判定（改过名字）", courseId));

        var after = plans.get(id);
        assertThat(after.getPlanName()).isEqualTo("停滞判定（改过名字）");
        assertThat(after.getLastStateChangedAt()).isEqualTo(before.getLastStateChangedAt());
        assertThat(after.getUpdatedAt()).isAfterOrEqualTo(before.getUpdatedAt());
    }

    @Test
    @DisplayName("SEC2：逻辑删除后列表与详情都查不到，行仍在库里")
    void 逻辑删除() {
        String name = "待删除" + System.nanoTime();
        long id = application.createPlan(计划表单(name, 造课程("待删除")));

        plans.softDelete(id);

        TrainingPlanQuery query = new TrainingPlanQuery();
        query.setKeyword(name);
        assertThat(plans.page(query).total()).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT deleted FROM biz_training_plan WHERE id = ?", Boolean.class, id)).isTrue();
    }

    @Test
    @DisplayName("下面还挂着场次的计划不能删——场次的入口只有计划详情页，删了它们就成了孤儿数据")
    void 有场次时拒绝删除计划() {
        long courseId = 造课程("带场次");
        long id = application.createPlan(计划表单("带场次的计划", courseId));
        造场次(id, courseId);

        assertThatThrownBy(() -> plans.softDelete(id))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED))
                .hasMessageContaining("还有 1 个培训场次");
    }

    // -------------------------------------------------------------------------
    // 列表与派生列
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 11.3 第 10 项：实际场次数是下属场次的实时 COUNT，不落列")
    void 实际场次数派生() {
        long courseId = 造课程("场次数");
        long id = application.createPlan(计划表单("场次数", courseId));
        assertThat(plans.get(id).getActualSessionCount()).isZero();

        long sessionId = 造场次(id, courseId);
        造场次(id, courseId);
        assertThat(plans.get(id).getActualSessionCount()).isEqualTo(2);

        jdbc.update("UPDATE biz_training_session SET deleted = TRUE WHERE id = ?", sessionId);
        assertThat(plans.get(id).getActualSessionCount())
                .describedAs("删掉的场次不该再计入实际场次数")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("需求 11.8 P4-2：关键字命中计划ID与名称，负责人姓名随列表带出")
    void 列表筛选() {
        String keyword = "筛选专用" + System.nanoTime();
        long courseId = 造课程("列表筛选");
        long id = application.createPlan(计划表单(keyword, courseId));

        TrainingPlanQuery query = new TrainingPlanQuery();
        query.setKeyword(keyword);
        PageResult<TrainingPlanListItem> page = plans.page(query);

        assertThat(page.total()).isEqualTo(1);
        assertThat(page.records()).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo(id);
            assertThat(item.getOwnerName()).isEqualTo("培训负责人");
            assertThat(item.getActualSessionCount()).isZero();
            assertThat(item.getPlanState()).isEqualTo("待执行");
        });

        TrainingPlanQuery byCourse = new TrainingPlanQuery();
        byCourse.setKeyword(keyword);
        byCourse.setCourseId(courseId + 1);
        assertThat(plans.page(byCourse).total()).isZero();
    }

    @Test
    @DisplayName("需求 11.8 P4-2：日期区间按「与计划期间有重叠」筛，跨月的计划不该被漏掉")
    void 日期区间按重叠筛选() {
        String keyword = "跨月计划" + System.nanoTime();
        long courseId = 造课程("跨月");
        LocalDate juneEnd = LocalDate.of(2026, 6, 28);
        application.createPlan(new TrainingPlanForm(keyword, courseId, ownerNo, "全体",
                juneEnd, LocalDate.of(2026, 8, 5), 2, null));

        TrainingPlanQuery july = new TrainingPlanQuery();
        july.setKeyword(keyword);
        july.setDateFrom(LocalDate.of(2026, 7, 1));
        july.setDateTo(LocalDate.of(2026, 7, 31));
        assertThat(july.getDateFrom()).isNotNull();
        assertThat(plans.page(july).total())
                .describedAs("6 月底开始、8 月初结束的计划正是 7 月在跑的重头戏，按包含关系筛会漏掉它")
                .isEqualTo(1);

        TrainingPlanQuery may = new TrainingPlanQuery();
        may.setKeyword(keyword);
        may.setDateFrom(LocalDate.of(2026, 5, 1));
        may.setDateTo(LocalDate.of(2026, 5, 31));
        assertThat(plans.page(may).total()).isZero();
    }

    // -------------------------------------------------------------------------
    // 状态与副作用
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 5.7 第 3／4 行：首次「已完成」写实际完成时间，退回再完成不覆盖它")
    void 实际完成时间只写一次() {
        long courseId = 造课程("完成时间");
        long id = application.createPlan(计划表单("完成时间", courseId));

        转换(id, "FIRST_SESSION_STARTED");
        转换(id, "ALL_SESSIONS_FINISHED");
        LocalDate first = plans.get(id).getActualFinishDate();
        assertThat(first).isEqualTo(LocalDate.now());

        // 把首次完成日改成过去，再走一遍「退回执行中 → 全部场次结束」
        jdbc.update("UPDATE biz_training_plan SET actual_finish_date = ? WHERE id = ?",
                LocalDate.now().minusDays(20), id);
        转换(id, "RETURN_TO_RUNNING");
        转换(id, "ALL_SESSIONS_FINISHED");

        assertThat(plans.get(id).getActualFinishDate())
                .describedAs("跟着最后一次走，会让反复退回的计划在 15.2.1 第 9 项里越来越晚完成")
                .isEqualTo(LocalDate.now().minusDays(20));
        assertThat(plans.get(id).getPlanState()).isEqualTo("已完成");
    }

    @Test
    @DisplayName("C3：非法转换硬阻断——「待执行」直接点「全部场次结束」要被拒绝")
    void 非法转换被拒绝() {
        long id = application.createPlan(计划表单("非法转换", 造课程("非法转换")));

        assertThatThrownBy(() -> 转换(id, "ALL_SESSIONS_FINISHED"))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.ILLEGAL_TRANSITION));
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private void 转换(long planId, String action) {
        transitions.transit(new TransitCommand(TrainingStateMachines.PLAN_OBJECT_TYPE, planId,
                TrainingStateMachines.FIELD_PLAN_STATE, action, null, null));
    }

    /** C-1 阶段还没有场次的写接口，实际场次数与删除保护只能用 SQL 造场次来验。 */
    private long 造场次(long planId, long courseId) {
        long lecturerId = 造讲师("场次讲师", "可上岗");
        return jdbc.queryForObject("""
                INSERT INTO biz_training_session (session_no, plan_id, session_name, course_id,
                                                  lecturer_id, training_date, start_time, end_time,
                                                  training_form, student_scope, session_state, created_by)
                VALUES (?, ?, '第1场', ?, ?, CURRENT_DATE, '09:00', '12:00', '线下',
                        '全体', '待开课', 'OPS')
                RETURNING id
                """, Long.class, "JHFIX" + System.nanoTime(), planId, courseId, lecturerId);
    }
}
