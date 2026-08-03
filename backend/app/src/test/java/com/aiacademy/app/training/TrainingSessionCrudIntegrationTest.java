package com.aiacademy.app.training;

import com.aiacademy.app.application.TrainingApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.business.training.domain.TrainingSessionListItem;
import com.aiacademy.business.training.domain.TrainingSessionQuery;
import com.aiacademy.business.training.service.TrainingSessionService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 培训场次的读写、场次号与派生字段（阶段 2 C-2 批，需求 11.4、11.9、5.8）。
 *
 * <p>排课三项校验单独放在 {@code SchedulingValidationIntegrationTest}——那是 C9 的例外条款，
 * 值得一整个测试类把三项的<b>不同性质</b>（两项硬阻断、一项仅提示）分别钉住。
 */
class TrainingSessionCrudIntegrationTest extends TrainingTestBase {

    @Autowired
    private TrainingSessionService sessions;

    @Autowired
    private TrainingApplicationService application;

    @Autowired
    private TransitionApplicationService transitions;

    // -------------------------------------------------------------------------
    // 场次号与自动字段
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 11.4 第 1 项：场次号是「计划号-2 位序号」，序号在计划内递增")
    void 场次号规则() {
        long courseId = 造课程("场次号");
        long planId = application.createPlan(计划表单("场次号计划", courseId));
        String planNo = jdbc.queryForObject(
                "SELECT plan_no FROM biz_training_plan WHERE id = ?", String.class, planId);

        long first = 建场次(planId, courseId).id();
        long second = 建场次(planId, courseId).id();

        assertThat(sessions.get(first).getSessionNo()).isEqualTo(planNo + "-01");
        assertThat(sessions.get(second).getSessionNo()).isEqualTo(planNo + "-02");
    }

    @Test
    @DisplayName("删掉一场之后序号不复用——场次号是三类导入模板的关联键，复用会让旧表格静默导错场次")
    void 场次序号不复用() {
        long courseId = 造课程("序号不复用");
        long planId = application.createPlan(计划表单("序号不复用", courseId));
        long first = 建场次(planId, courseId).id();

        sessions.softDelete(first);
        long third = 建场次(planId, courseId).id();

        assertThat(sessions.get(third).getSessionNo()).endsWith("-02");
    }

    @Test
    @DisplayName("需求 11.4 第 3 项：场次名称留空时自动生成「计划名称 第N场」")
    void 场次名称自动生成() {
        long courseId = 造课程("名称");
        long planId = application.createPlan(计划表单("客服大模型专题", courseId));

        long id = application.createSession(planId,
                场次表单(courseId, 造讲师("讲师甲", "可上岗")).名称(null).build()).id();

        assertThat(sessions.get(id).getSessionName()).isEqualTo("客服大模型专题 第1场");
    }

    @Test
    @DisplayName("需求 11.4 第 8 项：时长由起止时间算出，填了就以填的为准（中间休息只能手工覆盖）")
    void 时长推算与手工覆盖() {
        long courseId = 造课程("时长");
        long planId = application.createPlan(计划表单("时长", courseId));
        long lecturerId = 造讲师("讲师乙", "可上岗");

        long auto = application.createSession(planId, 场次表单(courseId, lecturerId).build()).id();
        assertThat(sessions.get(auto).getDurationHours()).isEqualByComparingTo("3.0");

        long manual = application.createSession(planId,
                场次表单(courseId, lecturerId).时长(new BigDecimal("2.5")).build()).id();
        assertThat(sessions.get(manual).getDurationHours()).isEqualByComparingTo("2.5");
    }

    @Test
    @DisplayName("C4／C5：新建场次要留下「（空）→ 待开课」的流转日志与 last_state_changed_at")
    void 新建补记初始流转() {
        long courseId = 造课程("初始流转");
        long planId = application.createPlan(计划表单("初始流转", courseId));

        long id = 建场次(planId, courseId).id();

        Map<String, Object> log = jdbc.queryForMap("""
                SELECT from_state, to_state, state_field FROM audit_state_log
                 WHERE object_type = ? AND object_id = ?
                """, TrainingStateMachines.SESSION_OBJECT_TYPE, id);
        assertThat(log.get("from_state")).isNull();
        assertThat(log.get("to_state")).isEqualTo("待开课");
        assertThat(log.get("state_field")).isEqualTo(TrainingStateMachines.FIELD_SESSION_STATE);
        assertThat(sessions.get(id).getLastStateChangedAt()).isNotNull();
    }

    // -------------------------------------------------------------------------
    // 字段校验
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 11.4 第 10／11 项：线下与混合必填培训地点，线上与混合必填线上链接")
    void 形式决定地点与链接必填() {
        long courseId = 造课程("形式");
        long planId = application.createPlan(计划表单("形式", courseId));
        long lecturerId = 造讲师("讲师丙", "可上岗");

        assertThatThrownBy(() -> application.createSession(planId,
                场次表单(courseId, lecturerId).形式(TrainingEnums.FORM_OFFLINE, null, null).build()))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode()).isEqualTo(ErrorCode.PARAM_INVALID))
                .hasMessageContaining("培训地点");

        assertThatThrownBy(() -> application.createSession(planId,
                场次表单(courseId, lecturerId).形式(TrainingEnums.FORM_ONLINE, null, null).build()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("线上链接");

        long hybrid = application.createSession(planId, 场次表单(courseId, lecturerId)
                .形式(TrainingEnums.FORM_HYBRID, "3 楼报告厅", "https://meeting.example.com/1")
                .build()).id();
        assertThat(sessions.get(hybrid).getTrainingForm()).isEqualTo(TrainingEnums.FORM_HYBRID);
    }

    @Test
    @DisplayName("结束时间必须晚于开始时间——否则算出的时长是负数，会污染讲师授课统计")
    void 时间区间不能倒挂() {
        long courseId = 造课程("时间倒挂");
        long planId = application.createPlan(计划表单("时间倒挂", courseId));
        long lecturerId = 造讲师("讲师丁", "可上岗");

        assertThatThrownBy(() -> application.createSession(planId,
                场次表单(courseId, lecturerId).时段(LocalTime.of(14, 0), LocalTime.of(9, 0)).build()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("结束时间");
    }

    // -------------------------------------------------------------------------
    // 列表、日历与派生列
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 11.9：按所属计划、讲师、状态、日期区间筛选，计划号与计划名随行带出")
    void 列表筛选() {
        long courseId = 造课程("列表");
        long planId = application.createPlan(计划表单("列表筛选计划" + System.nanoTime(), courseId));
        long lecturerId = 造讲师("列表讲师", "可上岗");
        long id = application.createSession(planId, 场次表单(courseId, lecturerId).build()).id();

        TrainingSessionQuery byPlan = new TrainingSessionQuery();
        byPlan.setPlanId(planId);
        assertThat(sessions.page(byPlan).records()).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo(id);
            assertThat(item.getPlanNo()).isNotBlank();
            assertThat(item.getSessionState()).isEqualTo("待开课");
            assertThat(item.getActualAttendeeCount()).isZero();
            assertThat(item.getAttendanceImported()).isFalse();
        });

        TrainingSessionQuery byLecturer = new TrainingSessionQuery();
        byLecturer.setPlanId(planId);
        byLecturer.setLecturerId(lecturerId + 1);
        assertThat(sessions.page(byLecturer).total()).isZero();

        TrainingSessionQuery byDate = new TrainingSessionQuery();
        byDate.setPlanId(planId);
        byDate.setDateFrom(LocalDate.now().plusDays(7));
        byDate.setDateTo(LocalDate.now().plusDays(7));
        assertThat(byDate.getDateFrom()).isNotNull();
        assertThat(sessions.page(byDate).total()).isEqualTo(1);
    }

    @Test
    @DisplayName("需求 11.4 第 14 项：实际签到人数只数「已签到」，是否已导入签到看有没有记录")
    void 签到派生列() {
        long courseId = 造课程("签到派生");
        long planId = application.createPlan(计划表单("签到派生", courseId));
        long id = 建场次(planId, courseId).id();

        造签到(id, TrainingEnums.ATTEND_PRESENT);
        造签到(id, TrainingEnums.ATTEND_ABSENT);

        TrainingSessionListItem item = sessions.get(id);
        assertThat(item.getActualAttendeeCount())
                .describedAs("未签到的人不算实际签到人数")
                .isEqualTo(1);
        assertThat(item.getAttendanceImported()).isTrue();

        TrainingSessionQuery imported = new TrainingSessionQuery();
        imported.setPlanId(planId);
        imported.setAttendanceImported(false);
        assertThat(sessions.page(imported).total()).isZero();
    }

    @Test
    @DisplayName("SEC2：逻辑删除后列表与详情都查不到，行仍在库里")
    void 逻辑删除() {
        long courseId = 造课程("删场次");
        long planId = application.createPlan(计划表单("删场次", courseId));
        long id = 建场次(planId, courseId).id();

        sessions.softDelete(id);

        TrainingSessionQuery query = new TrainingSessionQuery();
        query.setPlanId(planId);
        assertThat(sessions.page(query).total()).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT deleted FROM biz_training_session WHERE id = ?", Boolean.class, id)).isTrue();
    }

    // -------------------------------------------------------------------------
    // 状态推进
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 5.8：待开课 → 已开课 → 已结束 → 已归档，四个状态逐跳可走")
    void 场次状态主线() {
        long courseId = 造课程("状态主线");
        long planId = application.createPlan(计划表单("状态主线", courseId));
        long id = 建场次(planId, courseId).id();

        转换(id, "START");
        assertThat(sessions.get(id).getSessionState()).isEqualTo(TrainingStateMachines.SESSION_OPENED);

        // 「结束」带两个 DERIVE_TASK 副作用，它们归阶段 3；派发器记 INFO 而不是报错
        转换(id, "FINISH");
        assertThat(sessions.get(id).getSessionState()).isEqualTo(TrainingStateMachines.SESSION_FINISHED);

        转换(id, "ARCHIVE");
        assertThat(sessions.get(id).getSessionState()).isEqualTo(TrainingStateMachines.SESSION_ARCHIVED);
    }

    @Test
    @DisplayName("C1：首个场次开课不会自动把计划推到「执行中」——状态一律手动变更")
    void 计划状态不随场次自动流转() {
        long courseId = 造课程("不自动流转");
        long planId = application.createPlan(计划表单("不自动流转", courseId));
        long id = 建场次(planId, courseId).id();

        转换(id, "START");

        assertThat(jdbc.queryForObject("SELECT plan_state FROM biz_training_plan WHERE id = ?",
                String.class, planId))
                .describedAs("系统不做自动流转，「首个场次开课」由运营在计划上手动点")
                .isEqualTo("待执行");
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private TrainingApplicationService.SessionSaved 建场次(long planId, long courseId) {
        return application.createSession(planId,
                场次表单(courseId, 造讲师("场次讲师", "可上岗")).build());
    }

    private void 转换(long sessionId, String action) {
        transitions.transit(new TransitCommand(TrainingStateMachines.SESSION_OBJECT_TYPE, sessionId,
                TrainingStateMachines.FIELD_SESSION_STATE, action, null, null));
    }

    private void 造签到(long sessionId, String status) {
        jdbc.update("""
                INSERT INTO dtl_attendance (session_id, employee_no, employee_name_snapshot,
                                            attend_status, created_by)
                VALUES (?, ?, '学员', ?, 'OPS')
                """, sessionId, "E" + System.nanoTime(), status);
    }

}
