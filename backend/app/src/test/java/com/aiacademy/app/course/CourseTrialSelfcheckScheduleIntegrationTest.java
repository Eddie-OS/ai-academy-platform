package com.aiacademy.app.course;

import com.aiacademy.app.application.CourseApplicationService;
import com.aiacademy.app.application.CourseTrialApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.course.domain.CourseCalendarItem;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.course.domain.CourseSchedule;
import com.aiacademy.business.course.domain.CourseSelfcheckItem;
import com.aiacademy.business.course.domain.CourseSelfcheckView;
import com.aiacademy.business.course.domain.CourseTrial;
import com.aiacademy.business.course.domain.CourseTrialConclusionForm;
import com.aiacademy.business.course.domain.CourseTrialForm;
import com.aiacademy.business.course.service.CourseScheduleService;
import com.aiacademy.business.course.service.CourseSelfcheckService;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.business.course.service.CourseTrialService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 试讲记录（双结论）、自检 CheckList（题目快照）与课程排期（阶段 2 A-4 批）。
 *
 * <p>三块内容各自钉住一条容易被「好心纠正」的规则：
 * <ul>
 *   <li><b>试讲的两个结论互不影响</b>（议题 17、需求 9.7.3）——系统只置不一致标记，不做任何处置；
 *   <li><b>自检是纯自评</b>（议题 13、规则 CK3／CK6）——完成度不阻断提交评审、不进任何指标；
 *   <li><b>课程排期不做校验</b>（需求 9.9）——排课三项校验只作用于培训场次。
 * </ul>
 */
class CourseTrialSelfcheckScheduleIntegrationTest extends IntegrationTest {

    @Autowired
    private CourseService courses;

    @Autowired
    private CourseApplicationService application;

    @Autowired
    private CourseTrialService trials;

    @Autowired
    private CourseTrialApplicationService trialApplication;

    @Autowired
    private CourseSelfcheckService selfchecks;

    @Autowired
    private CourseScheduleService schedules;

    @Autowired
    private TransitionApplicationService transitions;

    @Autowired
    private JdbcTemplate jdbc;

    private String ownerNo;
    private long lecturerId;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
        ownerNo = 造人员("课程负责人");
        lecturerId = 造讲师("王讲师");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 试讲记录
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 9.7.1：试讲记录由运营手工新建，轮次 = 已有记录数 + 1")
    void 新建试讲轮次() {
        long id = 推到试讲("开试讲");

        long first = trialApplication.createRound(id, 试讲表单());
        trialApplication.recordConclusion(first, 结论(CourseEnums.CONCLUSION_UNQUALIFIED,
                CourseEnums.CONCLUSION_UNQUALIFIED));
        // 不合格回到优化，再走一遍评审才能回到试讲；这里只验证轮次，直接把主状态搬回去
        主状态(id, "RESUBMIT_REVIEW");
        主状态(id, "REVIEW_PASS");
        long second = trialApplication.createRound(id, 试讲表单());

        assertThat(trials.listByCourse(id)).extracting(CourseTrial::roundNo).containsExactly(2, 1);
        assertThat(trials.require(second).recordState()).isEqualTo("待录入结论");
        assertThat(trials.require(first).recordState()).isEqualTo("已完成");
    }

    @Test
    @DisplayName("需求 9.7.1：试讲讲师来自讲师池，不存在的讲师挡在录入之前")
    void 讲师必须在池内() {
        long id = 推到试讲("讲师校验");

        assertThatThrownBy(() -> trialApplication.createRound(id,
                new CourseTrialForm(LocalDate.now(), 999999L, null, null)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.PARAM_INVALID));
    }

    @Test
    @DisplayName("需求 5.3.1／5.4.3：课程结论=合格，主状态到发布，试讲子状态到待发布")
    void 课程结论合格驱动主状态与子状态() {
        long id = 推到试讲("结论合格");
        子状态(id, CourseStateMachines.FIELD_TRIAL_STATE, "START_TRIAL");
        long trialId = trialApplication.createRound(id, 试讲表单());

        trialApplication.recordConclusion(trialId,
                结论(CourseEnums.CONCLUSION_QUALIFIED, CourseEnums.CONCLUSION_QUALIFIED));

        assertThat(courses.get(id).getMainState()).isEqualTo("发布");
        assertThat(courses.get(id).getTrialState()).isEqualTo("待发布");
        assertThat(courses.get(id).getPublishState())
                .describedAs("需求 5.3.1 第 9 行的副作用：进入发布同时置课程发布子状态")
                .isEqualTo("已发布");
        assertThat(courses.get(id).getFirstPublishDate())
                .describedAs("副作用 SET_FIRST_PUBLISHED_AT：首次发布时间是有效期的起算点（EX1）")
                .isNotNull();
        assertThat(trials.require(trialId).recordState()).isEqualTo("已完成");
    }

    @Test
    @DisplayName("需求 10.3 第 9、10 项：讲师结论=合格置试讲合格标记，首次合格时间只写一次")
    void 讲师结论合格置试讲合格标记() {
        long first = trialApplication.createRound(推到试讲("首次合格"), 试讲表单());
        trialApplication.recordConclusion(first,
                结论(CourseEnums.CONCLUSION_QUALIFIED, CourseEnums.CONCLUSION_QUALIFIED));

        assertThat(讲师标记()).containsExactly(true, LocalDate.now(), "可上岗");

        // 同一位讲师换一门课再试讲一次，日期更晚。首次合格时间是「首次到达」型事实，不该被改写
        long second = trialApplication.createRound(推到试讲("二次合格"),
                new CourseTrialForm(LocalDate.now().plusDays(30), lecturerId, "张三", null));
        trialApplication.recordConclusion(second,
                结论(CourseEnums.CONCLUSION_QUALIFIED, CourseEnums.CONCLUSION_QUALIFIED));

        assertThat(讲师标记())
                .describedAs("重写会让这一项变成「最后一次合格是什么时候」，需求 15.3 的讲师培养周期会跟着错")
                .containsExactly(true, LocalDate.now(), "可上岗");
    }

    @Test
    @DisplayName("规则 TS5：讲师结论=不合格时不置标记，也不动培养状态")
    void 讲师结论不合格不置标记() {
        long trialId = trialApplication.createRound(推到试讲("讲师不合格"), 试讲表单());

        trialApplication.recordConclusion(trialId,
                结论(CourseEnums.CONCLUSION_QUALIFIED, CourseEnums.CONCLUSION_UNQUALIFIED));

        assertThat(讲师标记()).containsExactly(false, null, "可上岗");
    }

    /** 讲师的试讲合格标记、首次合格时间与培养状态。培养状态一并取出，验证 TS5「不自动改」。 */
    private List<Object> 讲师标记() {
        return jdbc.queryForObject("""
                SELECT trial_qualified, first_qualified_date, training_state
                  FROM biz_lecturer WHERE id = ?
                """,
                (rs, i) -> java.util.Arrays.asList(rs.getBoolean(1),
                        rs.getObject(2, LocalDate.class), rs.getString(3)),
                lecturerId);
    }

    @Test
    @DisplayName("没点过「开始试讲」也能录结论：子状态走不通就跳过，不拦住主状态")
    void 子状态走不通不影响录结论() {
        long id = 推到试讲("跳过子状态");
        long trialId = trialApplication.createRound(id, 试讲表单());

        trialApplication.recordConclusion(trialId,
                结论(CourseEnums.CONCLUSION_QUALIFIED, CourseEnums.CONCLUSION_QUALIFIED));

        assertThat(courses.get(id).getMainState()).isEqualTo("发布");
        assertThat(courses.get(id).getTrialState())
                .describedAs("子状态是展示用的。为了它拒掉录结论，等于拦住运营补录历史数据（规则 C2）")
                .isEqualTo("待试讲");
    }

    @Test
    @DisplayName("需求 9.7.3：两个结论不一致时照常保存，系统只置标记不做任何处置")
    void 结论不一致只标记不处置() {
        long id = 推到试讲("结论不一致");
        long trialId = trialApplication.createRound(id, 试讲表单());

        trialApplication.recordConclusion(trialId,
                结论(CourseEnums.CONCLUSION_QUALIFIED, CourseEnums.CONCLUSION_UNQUALIFIED));

        CourseTrial trial = trials.require(trialId);
        assertThat(trial.inconsistent())
                .describedAs("生成列，应用层不写。界面据此显示需求 9.7.3 规定的那句提示")
                .isTrue();
        assertThat(courses.get(id).getMainState())
                .describedAs("课程主状态只看课程结论，讲师结论不参与——二者独立（议题 17）")
                .isEqualTo("发布");
    }

    @Test
    @DisplayName("需求 5.3.1：课程结论=不合格，主状态回到优化")
    void 课程结论不合格回到优化() {
        long id = 推到试讲("结论不合格");
        long trialId = trialApplication.createRound(id, 试讲表单());

        trialApplication.recordConclusion(trialId,
                结论(CourseEnums.CONCLUSION_UNQUALIFIED, CourseEnums.CONCLUSION_QUALIFIED));

        assertThat(courses.get(id).getMainState()).isEqualTo("优化");
    }

    @Test
    @DisplayName("需求 9.7.2：验收标准按评审轨道取值，勾了另一条轨道的项目要挡住")
    void 验收标准按轨道受限() {
        long id = 推到试讲("验收标准");
        long trialId = trialApplication.createRound(id, 试讲表单());

        CourseTrialConclusionForm form = new CourseTrialConclusionForm(
                List.of("学员能直接使用"), CourseEnums.CONCLUSION_QUALIFIED,
                CourseEnums.CONCLUSION_QUALIFIED, "整体不错", null);

        assertThatThrownBy(() -> trialApplication.recordConclusion(trialId, form))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("内部端到端课程");
    }

    @Test
    @DisplayName("需求 9.8：已完成的试讲记录不可修改；同一份结论重提是双击，按 K2 处理")
    void 历史试讲记录只读() {
        long id = 推到试讲("试讲只读");
        long trialId = trialApplication.createRound(id, 试讲表单());
        CourseTrialConclusionForm 合格 = 结论(CourseEnums.CONCLUSION_QUALIFIED,
                CourseEnums.CONCLUSION_QUALIFIED);
        trialApplication.recordConclusion(trialId, 合格);

        assertThatThrownBy(() -> trialApplication.recordConclusion(trialId, 合格))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.DUPLICATE_SUBMIT));

        assertThatThrownBy(() -> trialApplication.recordConclusion(trialId,
                结论(CourseEnums.CONCLUSION_UNQUALIFIED, CourseEnums.CONCLUSION_QUALIFIED)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED));

        assertThat(trials.require(trialId).courseConclusion()).isEqualTo(CourseEnums.CONCLUSION_QUALIFIED);
    }

    // -------------------------------------------------------------------------
    // 自检 CheckList
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 9.4.2：勾选结果按题保存，完成度分母是启用中的题目数（CK1）")
    void 勾选与完成度() {
        long id = application.initiate(表单("自检完成度"));
        CourseSelfcheckView before = selfchecks.view(id);
        assertThat(before.totalCount()).isGreaterThan(0);
        assertThat(before.completedCount()).isZero();

        long 无需说明 = 找题(com.aiacademy.platform.dict.domain.SelfcheckItem.NOTE_NONE);
        CourseSelfcheckView after = selfchecks.save(id,
                List.of(new CourseSelfcheckService.Answer(无需说明, true, null)));

        assertThat(after.completedCount()).isEqualTo(1);
        assertThat(after.totalCount()).isEqualTo(before.totalCount());
    }

    @Test
    @DisplayName("规则 CK2：说明必填的题目勾了却没写说明，视为未完成——但照样存得下去")
    void 必填说明未填算未完成() {
        long id = application.initiate(表单("必填说明"));
        long 必填 = 找题(com.aiacademy.platform.dict.domain.SelfcheckItem.NOTE_REQUIRED);

        CourseSelfcheckView 未填 = selfchecks.save(id,
                List.of(new CourseSelfcheckService.Answer(必填, true, "   ")));
        assertThat(条目(未填, 必填).checked()).isTrue();
        assertThat(条目(未填, 必填).completed())
                .describedAs("自检是边填边存的，填一半必须存得下去，只是不算完成")
                .isFalse();

        CourseSelfcheckView 填了 = selfchecks.save(id,
                List.of(new CourseSelfcheckService.Answer(必填, true, "线下已与业务方确认")));
        assertThat(条目(填了, 必填).completed()).isTrue();
    }

    @Test
    @DisplayName("开发 6.3.9：题库改了文案，已勾选的历史记录仍显示当时那句话")
    void 题目文案快照不漂移() {
        long id = application.initiate(表单("题面快照"));
        long itemId = 找题(com.aiacademy.platform.dict.domain.SelfcheckItem.NOTE_NONE);
        String 原文 = 条目(selfchecks.save(id,
                List.of(new CourseSelfcheckService.Answer(itemId, true, null))), itemId).itemText();

        jdbc.update("UPDATE cfg_selfcheck_item SET item_text = ? WHERE id = ?", "改版后的新题面", itemId);

        assertThat(条目(selfchecks.view(id), itemId).itemText())
                .describedAs("显示新题面就等于说「开发者当初勾的是这一条」，而他勾的根本不是")
                .isEqualTo(原文);
    }

    @Test
    @DisplayName("规则 CK5：题目停用后不计入完成度分母，但已有的勾选仍然看得到")
    void 停用题不计分母但保留历史() {
        long id = application.initiate(表单("停用题目"));
        long itemId = 找题(com.aiacademy.platform.dict.domain.SelfcheckItem.NOTE_NONE);
        selfchecks.save(id, List.of(new CourseSelfcheckService.Answer(itemId, true, null)));
        int 分母 = selfchecks.view(id).totalCount();

        jdbc.update("UPDATE cfg_selfcheck_item SET enabled = FALSE WHERE id = ?", itemId);

        CourseSelfcheckView view = selfchecks.view(id);
        assertThat(view.totalCount()).isEqualTo(分母 - 1);
        assertThat(条目(view, itemId))
                .describedAs("历史记录仍可查看：停用不是删除")
                .isNotNull();
        assertThat(条目(view, itemId).enabled()).isFalse();
        assertThatThrownBy(() -> selfchecks.save(id,
                new java.util.ArrayList<>(List.of(new CourseSelfcheckService.Answer(itemId, false, null)))))
                .describedAs("停用题不再接受新的勾选")
                .isInstanceOf(BizException.class);
    }

    @Test
    @DisplayName("规则 CK3：自检一条没勾也能提交评审，系统不做门禁")
    void 自检不阻断提交评审() {
        long id = 推到自检("自检不拦人");

        主状态(id, "SUBMIT_REVIEW");

        assertThat(selfchecks.view(id).completedCount()).isZero();
        assertThat(courses.get(id).getMainState())
                .describedAs("加了门禁就会拦住运营补录历史课程（规则 C2、议题 13）")
                .isEqualTo("评审决策");
    }

    // -------------------------------------------------------------------------
    // 课程排期
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 9.9：排期节点增删改查，同一天排两个节点不受任何校验阻拦")
    void 排期节点增删改() {
        long id = application.initiate(表单("排期"));
        LocalDate day = LocalDate.now().plusDays(7);

        long first = schedules.create(id, new CourseSchedule.Form("完成初稿", day, null));
        schedules.create(id, new CourseSchedule.Form("内部走查", day, "同一天再排一个"));

        assertThat(schedules.listByCourse(id))
                .describedAs("排课三项校验只作用于培训场次创建（需求 9.9、11.4）")
                .hasSize(2);

        schedules.update(first, new CourseSchedule.Form("完成初稿", day.plusDays(1), "延后一天"));
        assertThat(schedules.listByCourse(id))
                .filteredOn(s -> s.id().equals(first))
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.planDate()).isEqualTo(day.plusDays(1));
                    assertThat(s.remark()).isEqualTo("延后一天");
                });

        schedules.delete(first);
        assertThat(schedules.listByCourse(id)).hasSize(1);
    }

    @Test
    @DisplayName("需求 9.9：日历同时给出开发节点与预计发布时间，并带出负责人与主状态")
    void 日历两类事件() {
        long id = application.initiate(表单("日历"));
        LocalDate node = LocalDate.now().plusDays(3);
        schedules.create(id, new CourseSchedule.Form("提交评审", node, null));

        List<CourseCalendarItem> items = schedules.calendar(
                LocalDate.now().minusDays(1), LocalDate.now().plusDays(60)).stream()
                .filter(i -> i.courseId() == id)
                .toList();

        assertThat(items).extracting(CourseCalendarItem::eventType)
                .containsExactlyInAnyOrder(CourseCalendarItem.EVENT_NODE,
                        CourseCalendarItem.EVENT_EXPECT_PUBLISH);
        assertThat(items).allSatisfy(i -> {
            assertThat(i.ownerName()).isEqualTo("课程负责人");
            assertThat(i.mainState()).isEqualTo("立项");
            assertThat(i.warningLight())
                    .describedAs("三色灯统一在阶段 3 的 aggregate/warning 里算，这里不提前算一遍")
                    .isNull();
        });
        assertThat(items).filteredOn(i -> CourseCalendarItem.EVENT_NODE.equals(i.eventType()))
                .singleElement()
                .satisfies(i -> {
                    assertThat(i.eventDate()).isEqualTo(node);
                    assertThat(i.nodeName()).isEqualTo("提交评审");
                });
    }

    @Test
    @DisplayName("已关闭的课程不再出现在排期日历上")
    void 终态课程不上日历() {
        long id = application.initiate(表单("关掉的课"));
        schedules.create(id, new CourseSchedule.Form("完成初稿", LocalDate.now().plusDays(5), null));
        主状态(id, CourseStateMachines.ACTION_CLOSE_DEVELOPMENT);

        assertThat(schedules.calendar(LocalDate.now().minusDays(1), LocalDate.now().plusDays(60)))
                .describedAs("它的计划日期已经没有意义，留着只会让运营每个月都看到一批不用管的条目")
                .noneMatch(i -> i.courseId() == id);
    }

    @Test
    @DisplayName("日历区间反了要给出可读提示，而不是返回空列表")
    void 日历区间校验() {
        assertThatThrownBy(() -> schedules.calendar(LocalDate.now(), LocalDate.now().minusDays(1)))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("结束日期");
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private CourseForm 表单(String name) {
        return new CourseForm(name + System.nanoTime(), CourseEnums.TRACK_INTERNAL, "COURSE", ownerNo,
                LocalDate.now().minusDays(30), LocalDate.now().plusDays(30),
                name + " 的简介", "一线客服", new BigDecimal("4.5"), null, null, null,
                "12 个月", "https://example.com/course", List.of("推荐"));
    }

    private CourseTrialForm 试讲表单() {
        return new CourseTrialForm(LocalDate.now(), lecturerId, "张三、李四", null);
    }

    private CourseTrialConclusionForm 结论(String course, String lecturer) {
        return new CourseTrialConclusionForm(List.of("内容易理解", "节奏适当"), course, lecturer,
                "整体达到验收要求", "第 3 章示例需要补充");
    }

    private long 推到自检(String name) {
        long id = application.initiate(表单(name));
        主状态(id, "START_DEVELOP");
        子状态(id, CourseStateMachines.FIELD_DEV_STATE, "START_DEVELOP");
        主状态(id, "ENTER_SELF_CHECK");
        return id;
    }

    /** 立项 → … → 评审决策 → 试讲。评审结论走通用转换接口，本类不重复验证评审记录。 */
    private long 推到试讲(String name) {
        long id = 推到自检(name);
        主状态(id, "SUBMIT_REVIEW");
        主状态(id, "REVIEW_PASS");
        return id;
    }

    private void 主状态(long id, String action) {
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, id,
                CourseStateMachines.FIELD_MAIN_STATE, action, null, null));
    }

    private void 子状态(long id, String field, String action) {
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, id, field,
                action, null, null));
    }

    private long 找题(String noteRequirement) {
        Long id = jdbc.queryForObject("""
                SELECT MIN(id) FROM cfg_selfcheck_item
                 WHERE note_requirement = ? AND enabled = TRUE AND deleted = FALSE
                """, Long.class, noteRequirement);
        assertThat(id).describedAs("题库初始数据里应有「说明%s」的题目", noteRequirement).isNotNull();
        return id;
    }

    private CourseSelfcheckItem 条目(CourseSelfcheckView view, long itemId) {
        return view.items().stream()
                .filter(i -> i.itemId() == itemId)
                .findFirst()
                .orElseThrow(() -> new AssertionError("自检列表里没有题目 " + itemId));
    }

    private String 造人员(String name) {
        String no = "E" + System.nanoTime() % 100000000L;
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, '客服中心', '讲师', '在职', 'operator')
                """, no, name);
        return no;
    }

    private long 造讲师(String name) {
        // JSFIX 前缀不匹配 LecturerMapper 取号用的 ^JS[0-9]+$，夹具因此不会挤占真实讲师编号
        String no = "JSFIX" + System.nanoTime() % 100000000L;
        return jdbc.queryForObject("""
                INSERT INTO biz_lecturer (lecturer_no, lecturer_name, employee_no, source_dept,
                                          expertise_domains, teaching_direction, join_type,
                                          joined_date, training_state, pool_state, created_by)
                VALUES (?, ?, ?, '客服中心', '["客服"]'::jsonb, 'AI 应用', '运营手动添加',
                        CURRENT_DATE, '可上岗', '在池', 'operator')
                RETURNING id
                """, Long.class, no, name, 造人员(name));
    }
}
