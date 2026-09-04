package com.aiacademy.app.course;

import com.aiacademy.app.application.CourseApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.course.domain.CourseListItem;
import com.aiacademy.business.course.domain.CourseQuery;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.IllegalTransitionException;
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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 课程主表的读写（阶段 2 A-2 批）。
 *
 * <p>用真实 PostgreSQL：有效期状态在 SQL 里有一份 CASE 表达式、在 Java 里有一份
 * {@code CourseValidity}，两份的一致性是本类要钉住的东西之一，而 {@code CURRENT_DATE + 30}
 * 这类写法只有在真库上跑才算数。
 */
class CourseCrudIntegrationTest extends IntegrationTest {

    @Autowired
    private CourseService courses;

    @Autowired
    private CourseApplicationService application;

    @Autowired
    private TransitionApplicationService transitions;

    @Autowired
    private JdbcTemplate jdbc;

    private String ownerNo;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
        ownerNo = 造人员("课程负责人");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 立项
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 9.3.1 第 1 项：课程编号是 KC + 年月 + 4 位流水，且逐条递增")
    void 课程编号规则() {
        String first = courses.get(application.initiate(表单("编号规则 A"))).getCourseNo();
        String second = courses.get(application.initiate(表单("编号规则 B"))).getCourseNo();

        String yearMonth = LocalDate.now().toString().substring(0, 7).replace("-", "");
        assertThat(first).matches("KC" + yearMonth + "\\d{4}");
        assertThat(courses.get(application.initiate(表单("立项单号"))).getInitiationNo())
                .matches("LI" + yearMonth + "\\d{4}");
        assertThat(Integer.parseInt(second.substring(8)))
                .describedAs("流水必须递增，重号会撞上 uk_course_no")
                .isEqualTo(Integer.parseInt(first.substring(8)) + 1);
    }

    @Test
    @DisplayName("详情立项页：立项单号是 LI + 年月 + 4 位流水，与课程编号独立")
    void 立项单号规则() {
        String yearMonth = LocalDate.now().toString().substring(0, 7).replace("-", "");
        String no = courses.get(application.initiate(表单("立项单号"))).getInitiationNo();
        assertThat(no).matches("LI" + yearMonth + "\\d{4}");
        assertThat(no).isNotEqualTo(courses.get(application.initiate(表单("另一门"))).getCourseNo());
    }

    @Test
    @DisplayName("E1-2：立项要留下「（空）→ 立项」的流转日志与 last_state_changed_at")
    void 立项补记初始流转() {
        long id = application.initiate(表单("初始流转"));

        Map<String, Object> log = jdbc.queryForMap("""
                SELECT from_state, to_state, state_field FROM audit_state_log
                 WHERE object_type = 'COURSE' AND object_id = ?
                """, id);
        assertThat(log.get("from_state"))
                .describedAs("起点没有时间戳时，需求 15.2 的课程开发周期就少一条数据，且事后无法补齐")
                .isNull();
        assertThat(log.get("to_state")).isEqualTo("立项");
        assertThat(log.get("state_field")).isEqualTo(CourseStateMachines.FIELD_MAIN_STATE);

        assertThat(courses.get(id).getLastStateChangedAt()).isNotNull();
    }

    @Test
    @DisplayName("需求 5.3.1：子状态随主状态置位，且置位本身也要写流转日志")
    void 子状态随主状态置位() {
        long id = application.initiate(表单("子状态置位"));

        主状态(id, "START_DEVELOP");

        assertThat(courses.get(id).getDevState()).isEqualTo("待开发");
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM audit_state_log
                 WHERE object_type = 'COURSE' AND object_id = ? AND state_field = ?
                """, Integer.class, id, CourseStateMachines.FIELD_DEV_STATE))
                .describedAs("子状态也是状态，绕过引擎直接改列会让它在流转日志里消失")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("C2／5.3.2：子状态没有通路时只跳过置位，不阻断主状态变更")
    void 子状态无通路不阻断主状态() {
        long id = application.initiate(表单("跳过开始开发"));
        主状态(id, "START_DEVELOP");

        // 没点过子状态的「开始开发」，开发子状态停在「待开发」，到「自检中」没有通路
        主状态(id, "ENTER_SELF_CHECK");

        var course = courses.get(id);
        assertThat(course.getMainState()).isEqualTo("自检");
        assertThat(course.getDevState())
                .describedAs("四组子状态各自独立、不做组合校验（需求 5.3.2），为展示字段拦住主状态变更会挡住历史数据录入")
                .isEqualTo("待开发");
    }

    // -------------------------------------------------------------------------
    // 编辑与并发
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("C5：改一个错别字只动 updated_at，不动 last_state_changed_at（红灯不该因此消失）")
    void 编辑不影响停滞判定() {
        long id = application.initiate(表单("停滞判定"));
        var before = courses.get(id);

        courses.update(id, 表单("停滞判定（改过名字）"), before.getVersion());

        var after = courses.get(id);
        assertThat(after.getCourseName()).isEqualTo("停滞判定（改过名字）");
        assertThat(after.getLastStateChangedAt()).isEqualTo(before.getLastStateChangedAt());
        assertThat(after.getVersion()).isEqualTo(before.getVersion() + 1);
    }

    @Test
    @DisplayName("K1：版本号过期时报 CONCURRENT_MODIFIED，文案要说明是被他人改的")
    void 乐观锁冲突() {
        long id = application.initiate(表单("并发编辑"));
        int staleVersion = courses.get(id).getVersion();
        courses.update(id, 表单("先到先得"), staleVersion);

        assertThatThrownBy(() -> courses.update(id, 表单("后到的改动"), staleVersion))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.CONCURRENT_MODIFIED))
                .hasMessageContaining("已被他人修改");
    }

    // -------------------------------------------------------------------------
    // 有效期（EX1～EX8）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("EX3：没发布过就没有有效期起算点，状态是「未发布」而不是「有效」")
    void 未发布无截止日() {
        long id = application.initiate(表单("未发布"));

        var course = courses.get(id);
        assertThat(course.getValidityEndDate()).isNull();
        assertThat(course.getValidityStatus()).isEqualTo("未发布");
        assertThat(course.getDaysToExpiry()).isNull();
    }

    @Test
    @DisplayName("EX1／EX2：首次进入发布写首次发布时间与截止日，再次发布不重算")
    void 首次发布只写一次() {
        long id =推到发布(表单("首次发布"));

        var published = courses.get(id);
        assertThat(published.getFirstPublishDate()).isEqualTo(LocalDate.now());
        assertThat(published.getValidityEndDate()).isEqualTo(LocalDate.now().plusMonths(12));
        assertThat(published.getValidityStatus()).isEqualTo("有效");

        // 把首次发布时间改早，模拟一门去年发布的课程；再次触发效果时不应被今天覆盖
        jdbc.update("UPDATE biz_course SET first_publish_date = ? WHERE id = ?",
                LocalDate.now().minusMonths(6), id);
        courses.markFirstPublished(id);

        assertThat(courses.get(id).getFirstPublishDate())
                .describedAs("EX2：首次发布时间是课程开发周期的终点，重算会让指标变成「最后一次发布用了多久」")
                .isEqualTo(LocalDate.now().minusMonths(6));
    }

    @Test
    @DisplayName("EX3：改了有效期时长，截止日必须跟着重算")
    void 改时长重算截止日() {
        long id =推到发布(表单("重算截止日"));

        courses.update(id, 表单("重算截止日", "3 个月"), courses.get(id).getVersion());

        assertThat(courses.get(id).getValidityEndDate())
                .describedAs("界面上同时显示「有效期 3 个月」和一个按 12 个月算的到期日，运营无从判断哪个对")
                .isEqualTo(courses.get(id).getFirstPublishDate().plusMonths(3));
    }

    @Test
    @DisplayName("EX7：有效期状态实时计算，SQL 侧的筛选口径必须与 Java 侧的展示口径一致")
    void 有效期状态两份实现一致() {
        long expired = 推到发布(表单("已过期的课"));
        jdbc.update("UPDATE biz_course SET first_publish_date = ?, validity_end_date = ? WHERE id = ?",
                LocalDate.now().minusMonths(13), LocalDate.now().minusDays(1), expired);

        long expiring = 推到发布(表单("快到期的课"));
        jdbc.update("UPDATE biz_course SET validity_end_date = ? WHERE id = ?",
                LocalDate.now().plusDays(10), expiring);

        long valid = 推到发布(表单("还早的课"));
        long unpublished = application.initiate(表单("没发布的课"));

        assertThat(按状态筛选("已过期")).contains(expired).doesNotContain(expiring, valid, unpublished);
        assertThat(按状态筛选("30 天内到期")).contains(expiring).doesNotContain(expired, valid, unpublished);
        assertThat(按状态筛选("有效")).contains(valid).doesNotContain(expired, expiring, unpublished);
        assertThat(按状态筛选("未发布")).contains(unpublished).doesNotContain(expired, expiring, valid);

        // 两份实现的一致性：筛出来的每一条，Java 侧算出的状态必须是同一个值
        for (String status : List.of("已过期", "30 天内到期", "有效", "未发布")) {
            CourseQuery query = new CourseQuery();
            query.setValidityStatus(status);
            query.setPageSize(200);
            assertThat(courses.page(query).records())
                    .describedAs("SQL 的 CASE 与 CourseValidity 是同一口径的两份实现，筛选与展示必须对得上")
                    .allSatisfy(item -> assertThat(item.getValidityStatus()).isEqualTo(status));
        }
    }

    // -------------------------------------------------------------------------
    // 关闭
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 5.3.1 第 15 行：立项状态可以直接关闭，关闭原因与状态一起落库")
    void 早期关闭() {
        long id = application.initiate(表单("早期关闭"));

        application.close(id, "线下评审判定不做", courses.get(id).getVersion());

        var closed = courses.get(id);
        assertThat(closed.getMainState()).isEqualTo("已关闭");
        assertThat(closed.getCloseReason()).isEqualTo("线下评审判定不做");
    }

    @Test
    @DisplayName("C3：已发布的课程不能关闭开发，硬阻断在服务层且关闭原因不会留下")
    void 非法关闭被硬阻断() {
        long id =推到发布(表单("已发布不能关"));

        assertThatThrownBy(() -> application.close(id, "试图关闭", null))
                .isInstanceOf(IllegalTransitionException.class);

        var course = courses.get(id);
        assertThat(course.getMainState()).isEqualTo("发布");
        assertThat(course.getCloseReason())
                .describedAs("先转换后写原因，转换失败时整个请求回滚，原因不该留在一门正常推进的课程上")
                .isNull();
    }

    // -------------------------------------------------------------------------
    // 列表
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 9.10：筛选与关键字命中课程ID／名称／简介，分页总数与记录数一致")
    void 列表筛选() {
        String keyword = "筛选专用" + System.nanoTime();
        long id = application.initiate(表单(keyword));

        CourseQuery query = new CourseQuery();
        query.setKeyword(keyword);
        PageResult<CourseListItem> page = courses.page(query);

        assertThat(page.total()).isEqualTo(1);
        assertThat(page.records()).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo(id);
            assertThat(item.getOwnerName()).isEqualTo("课程负责人");
            assertThat(item.getReviewRound()).isZero();
            assertThat(item.getHasDemand()).isFalse();
        });

        CourseQuery byOwner = new CourseQuery();
        byOwner.setKeyword(keyword);
        byOwner.setOwnerNo("不存在的工号");
        assertThat(courses.page(byOwner).total()).isZero();
    }

    @Test
    @DisplayName("列表「评审状态」筛的是最新一轮评审记录，不是课程主状态")
    void 按最新评审记录状态筛选() {
        String keyword = "评审状态筛" + System.nanoTime();
        long pendingId = application.initiate(表单(keyword + "待录"));
        long doneId = application.initiate(表单(keyword + "完成"));
        long noneId = application.initiate(表单(keyword + "未评"));

        jdbc.update(
                """
                INSERT INTO dtl_course_review
                    (course_id, round_no, review_date, record_state, created_by, updated_by)
                VALUES (?, 1, CURRENT_DATE, '待录入结论', 'ops', 'ops'),
                       (?, 1, CURRENT_DATE, '已完成', 'ops', 'ops')
                """,
                pendingId, doneId);

        CourseQuery pending = new CourseQuery();
        pending.setKeyword(keyword);
        pending.setReviewRecordState("待录入结论");
        assertThat(courses.page(pending).records())
                .extracting(CourseListItem::getId)
                .containsExactly(pendingId);

        CourseQuery done = new CourseQuery();
        done.setKeyword(keyword);
        done.setReviewRecordState("已完成");
        assertThat(courses.page(done).records())
                .extracting(CourseListItem::getId)
                .containsExactly(doneId);

        CourseQuery all = new CourseQuery();
        all.setKeyword(keyword);
        assertThat(courses.page(all).records())
                .extracting(CourseListItem::getId)
                .containsExactlyInAnyOrder(pendingId, doneId, noneId);
    }

    @Test
    @DisplayName("SEC2：逻辑删除后列表与详情都查不到，行仍在库里")
    void 逻辑删除() {
        String keyword = "待删除" + System.nanoTime();
        long id = application.initiate(表单(keyword));

        courses.softDelete(id);

        CourseQuery query = new CourseQuery();
        query.setKeyword(keyword);
        assertThat(courses.page(query).total()).isZero();
        assertThat(jdbc.queryForObject("SELECT deleted FROM biz_course WHERE id = ?", Boolean.class, id))
                .isTrue();
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private CourseForm 表单(String name) {
        return 表单(name, "12 个月");
    }

    private CourseForm 表单(String name, String validityPeriod) {
        return new CourseForm(name, "内部端到端课程", "COURSE", ownerNo,
                LocalDate.now().minusDays(30), LocalDate.now().plusDays(30),
                name + " 的简介", "一线客服", new BigDecimal("4.5"), null, null, null,
                validityPeriod, "https://example.com/course", List.of("推荐"));
    }

    /**
     * 立项 → 开发 → 自检 → 评审决策 → 试讲 → 发布，即需求 5.3.1 的正向主线。
     *
     * <p>中间插一次开发子状态的「开始开发」：主状态「开发 → 自检」的副作用要把开发子状态置成
     * 「自检中」，而需求 5.4.1 里「自检中」只能从「开发中」到达。
     */
    private long 推到发布(CourseForm form) {
        long id = application.initiate(form);
        主状态(id, "START_DEVELOP");
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, id,
                CourseStateMachines.FIELD_DEV_STATE, "START_DEVELOP", null, null));
        for (String action : List.of("ENTER_SELF_CHECK", "SUBMIT_REVIEW", "REVIEW_PASS",
                "TRIAL_COURSE_PASS")) {
            主状态(id, action);
        }
        return id;
    }

    private void 主状态(long id, String action) {
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, id,
                CourseStateMachines.FIELD_MAIN_STATE, action, null, null));
    }

    private List<Long> 按状态筛选(String validityStatus) {
        CourseQuery query = new CourseQuery();
        query.setValidityStatus(validityStatus);
        query.setPageSize(200);
        return courses.page(query).records().stream().map(CourseListItem::getId).toList();
    }

    private String 造人员(String name) {
        String no = "E" + System.nanoTime();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, '客服中心', '讲师', '在职', 'operator')
                """, no, name);
        return no;
    }
}
