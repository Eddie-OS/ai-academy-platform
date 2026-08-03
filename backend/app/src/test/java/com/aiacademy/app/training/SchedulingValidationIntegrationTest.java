package com.aiacademy.app.training;

import com.aiacademy.app.application.TrainingApplicationService;
import com.aiacademy.business.training.service.TrainingSessionService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 排课三项校验（阶段 2 C-2 批，需求 11.4.1，规则 C9 三处例外之二）。
 *
 * <p>三项的<b>性质不同</b>，这个测试类的主要价值就是把这个差别钉死：
 * 讲师未可上岗与课程未发布是<b>硬阻断</b>，讲师时段冲突只是<b>提示</b>。
 * 把第三项做成阻断，等于让系统替线下做判断——而同一讲师一天讲两场是常见安排。
 */
class SchedulingValidationIntegrationTest extends TrainingTestBase {

    @Autowired
    private TrainingApplicationService application;

    @Autowired
    private TrainingSessionService sessions;

    // -------------------------------------------------------------------------
    // 校验一：讲师是否可上岗（硬阻断）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("校验一：讲师培养状态不是「可上岗」时硬阻断，文案要说清当前是什么状态")
    void 讲师未可上岗时阻断() {
        long courseId = 造课程("讲师校验");
        long planId = application.createPlan(计划表单("讲师校验", courseId));
        long lecturerId = 造讲师("小王", "培养中");

        assertThatThrownBy(() -> application.createSession(planId,
                场次表单(courseId, lecturerId).build()))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED))
                .hasMessageContaining("小王")
                .hasMessageContaining("培养中")
                .hasMessageContaining("无法排课");
    }

    @Test
    @DisplayName("C3：硬阻断要整笔回滚——被拒的场次不能留在库里，也不能占掉一个场次号")
    void 阻断后不留残留数据() {
        long courseId = 造课程("回滚");
        long planId = application.createPlan(计划表单("回滚", courseId));

        assertThatThrownBy(() -> application.createSession(planId,
                场次表单(courseId, 造讲师("小李", "待培养")).build()))
                .isInstanceOf(BizException.class);

        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM biz_training_session WHERE plan_id = ?", Integer.class, planId))
                .describedAs("校验在状态转换的副作用里抛出，整笔事务回滚，INSERT 一起退掉")
                .isZero();
    }

    @Test
    @DisplayName("落地要点第 5 条：排课后讲师被改回「培养中」，已存在的场次不受影响、不报错")
    void 已排场次不回溯() {
        long courseId = 造课程("不回溯");
        long planId = application.createPlan(计划表单("不回溯", courseId));
        long lecturerId = 造讲师("小张", "可上岗");
        long id = application.createSession(planId, 场次表单(courseId, lecturerId).build()).id();

        jdbc.update("UPDATE biz_lecturer SET training_state = '培养中' WHERE id = ?", lecturerId);

        assertThat(sessions.get(id).getLecturerId()).isEqualTo(lecturerId);
    }

    // -------------------------------------------------------------------------
    // 校验二：课程是否可发布（硬阻断）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("校验二：课程主状态不在「发布及之后」时硬阻断")
    void 课程未发布时阻断() {
        long courseId = 造课程("大模型入门", "评审决策");
        long planId = application.createPlan(计划表单("课程校验", courseId));

        assertThatThrownBy(() -> application.createSession(planId,
                场次表单(courseId, 造讲师("小赵", "可上岗")).build()))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED))
                .hasMessageContaining("大模型入门")
                .hasMessageContaining("尚未发布");
    }

    @Test
    @DisplayName("校验二：发布之后的三个主状态都能排课（发布 / 推广 / 精品案例）")
    void 发布之后的三个状态都能排课() {
        for (String state : CourseStateMachines.MAIN_STATES_SCHEDULABLE) {
            long courseId = 造课程("可排课的课", state);
            long planId = application.createPlan(计划表单("可排课 " + state, courseId));

            long id = application.createSession(planId,
                    场次表单(courseId, 造讲师("讲师", "可上岗")).build()).id();

            assertThat(sessions.get(id).getCourseId())
                    .describedAs("课程主状态「%s」应当允许排课", state)
                    .isEqualTo(courseId);
        }
    }

    // -------------------------------------------------------------------------
    // 校验三：讲师时段冲突（仅提示）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("校验三：同一讲师同一天时段重叠只提示不阻断，场次照常保存")
    void 时段冲突只提示() {
        long courseId = 造课程("时段冲突");
        long planId = application.createPlan(计划表单("时段冲突", courseId));
        long lecturerId = 造讲师("孙老师", "可上岗");
        LocalDate date = LocalDate.now().plusDays(3);

        application.createSession(planId, 场次表单(courseId, lecturerId).日期(date)
                .时段(LocalTime.of(9, 0), LocalTime.of(12, 0)).build());

        TrainingApplicationService.SessionSaved second = application.createSession(planId,
                场次表单(courseId, lecturerId).日期(date)
                        .时段(LocalTime.of(10, 0), LocalTime.of(15, 0)).build());

        assertThat(second.warnings())
                .describedAs("同一讲师一天讲两场是常见安排，判断权交给运营")
                .hasSize(1);
        assertThat(second.warnings().get(0)).contains("孙老师").contains("确认继续？");
        assertThat(sessions.get(second.id()).getSessionState()).isEqualTo("待开课");
    }

    @Test
    @DisplayName("校验三：上午 9–12 接下午 12–15 不算冲突，闭区间判定会把最常见的连排误报成冲突")
    void 首尾相接不算冲突() {
        long courseId = 造课程("连排");
        long planId = application.createPlan(计划表单("连排", courseId));
        long lecturerId = 造讲师("周老师", "可上岗");
        LocalDate date = LocalDate.now().plusDays(4);

        application.createSession(planId, 场次表单(courseId, lecturerId).日期(date)
                .时段(LocalTime.of(9, 0), LocalTime.of(12, 0)).build());

        TrainingApplicationService.SessionSaved second = application.createSession(planId,
                场次表单(courseId, lecturerId).日期(date)
                        .时段(LocalTime.of(12, 0), LocalTime.of(15, 0)).build());

        assertThat(second.warnings()).isEmpty();
    }

    @Test
    @DisplayName("规则 EX6：过期课程仍可排课，只给非阻断提示")
    void 过期课程只提示() {
        long courseId = 造课程("过期课", "推广");
        jdbc.update("UPDATE biz_course SET validity_end_date = ? WHERE id = ?",
                LocalDate.now().minusDays(10), courseId);
        long planId = application.createPlan(计划表单("过期课", courseId));

        TrainingApplicationService.SessionSaved saved = application.createSession(planId,
                场次表单(courseId, 造讲师("吴老师", "可上岗")).build());

        assertThat(saved.warnings()).anySatisfy(w -> assertThat(w).contains("有效期已于"));
        assertThat(sessions.get(saved.id()).getCourseId()).isEqualTo(courseId);
    }

    // -------------------------------------------------------------------------
    // 触发时机：四种操作都要重新校验（落地要点第 2 条）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("落地要点第 2 条：编辑时改成培养中的讲师同样被阻断，只在创建时校验等于没有校验")
    void 编辑改讲师时重新校验() {
        long courseId = 造课程("编辑校验");
        long planId = application.createPlan(计划表单("编辑校验", courseId));
        long id = application.createSession(planId,
                场次表单(courseId, 造讲师("原讲师", "可上岗")).build()).id();
        long 培养中讲师 = 造讲师("新讲师", "培养中");

        assertThatThrownBy(() -> application.updateSession(id,
                场次表单(courseId, 培养中讲师).build()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("无法排课");
    }

    @Test
    @DisplayName("需求 11.8：日历拖动改期后重新算时段冲突，改期本身仍然成功")
    void 拖动改期后重算冲突() {
        long courseId = 造课程("拖动");
        long planId = application.createPlan(计划表单("拖动", courseId));
        long lecturerId = 造讲师("郑老师", "可上岗");
        LocalDate day1 = LocalDate.now().plusDays(5);
        LocalDate day2 = LocalDate.now().plusDays(6);

        application.createSession(planId, 场次表单(courseId, lecturerId).日期(day1).build());
        long moving = application.createSession(planId,
                场次表单(courseId, lecturerId).日期(day2).build()).id();

        TrainingApplicationService.SessionSaved moved = application.reschedule(moving, day1);

        assertThat(sessions.get(moving).getTrainingDate()).isEqualTo(day1);
        assertThat(moved.warnings())
                .describedAs("拖到另一天正是可能撞上别的场次的操作，冲突必须重算")
                .hasSize(1);
    }

    @Test
    @DisplayName("预检接口只返回提示类结果，供前端在提交前弹二次确认")
    void 保存前预检() {
        long courseId = 造课程("预检");
        long planId = application.createPlan(计划表单("预检", courseId));
        long lecturerId = 造讲师("冯老师", "可上岗");
        LocalDate date = LocalDate.now().plusDays(8);
        application.createSession(planId, 场次表单(courseId, lecturerId).日期(date).build());

        List<String> warnings = application.checkScheduling(courseId, lecturerId, date,
                LocalTime.of(10, 0), LocalTime.of(11, 0), null);

        assertThat(warnings).hasSize(1);
    }

    @Test
    @DisplayName("落地要点第 4 条：排课下拉只给能排的——讲师限可上岗，课程限发布之后的主状态")
    void 排课候选只列可选项() {
        long 可排课程 = 造课程("可排的课", "发布");
        long 未发布课程 = 造课程("还没发布的课", "评审决策");
        long 可上岗讲师 = 造讲师("可上岗的人", "可上岗");
        long 培养中讲师 = 造讲师("培养中的人", "培养中");

        TrainingApplicationService.SchedulingOptions options = application.schedulingOptions(null);

        assertThat(options.courses()).extracting(c -> c.id()).contains(可排课程).doesNotContain(未发布课程);
        assertThat(options.lecturers()).extracting(l -> l.id())
                .describedAs("下拉里出现一个选了必被拒的讲师，是让运营白填一遍表单")
                .contains(可上岗讲师).doesNotContain(培养中讲师);
    }

    @Test
    @DisplayName("排课候选的关键字只筛课程：讲师池是百人量级，一次给全反而省事")
    void 排课候选按关键字筛课程() {
        long 命中 = 造课程("提示词工程实战", "发布");
        long 不命中 = 造课程("数据治理基础", "发布");

        TrainingApplicationService.SchedulingOptions options = application.schedulingOptions("提示词");

        assertThat(options.courses()).extracting(c -> c.id()).contains(命中).doesNotContain(不命中);
        assertThat(options.lecturers()).describedAs("讲师不受课程关键字影响").isNotNull();
    }
}
