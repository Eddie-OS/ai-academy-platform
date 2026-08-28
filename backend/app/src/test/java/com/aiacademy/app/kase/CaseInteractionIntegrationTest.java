package com.aiacademy.app.kase;

import com.aiacademy.app.application.CaseApplicationService;
import com.aiacademy.app.application.CaseReportApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.kase.domain.CaseAuditForm;
import com.aiacademy.business.kase.domain.CaseComment;
import com.aiacademy.business.kase.domain.CaseCommentForm;
import com.aiacademy.business.kase.domain.CaseEnums;
import com.aiacademy.business.kase.domain.CaseInteractionStats;
import com.aiacademy.business.kase.domain.CaseReportForm;
import com.aiacademy.business.kase.service.CaseInteractionService;
import com.aiacademy.business.kase.service.CaseReportService;
import com.aiacademy.business.kase.service.CaseService;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 浏览、点赞、评论与总结报告（需求 12.4、12.6）。
 *
 * <p>这一组规则是 V1.2 按共享账号模型重写的重灾区：凡依赖个人身份的去重都取消了，看起来全都
 * 「不合理」。本类把四条最容易被顺手补回去的写成断言——
 * <ul>
 *   <li>浏览与点赞<b>都不去重</b>，同一账号连点五次就是五次；
 *   <li>点赞防刷是<b>静默丢弃</b>，不报错；
 *   <li>单次停留时长封顶 30 分钟，挂了一夜的页面不会污染平均阅读时长；
 *   <li>报告一经编辑，生成方式转「手动编辑」。
 * </ul>
 */
class CaseInteractionIntegrationTest extends IntegrationTest {

    @Autowired
    private CaseService cases;

    @Autowired
    private CaseApplicationService application;

    @Autowired
    private CaseInteractionService interactions;

    @Autowired
    private CaseReportService reports;

    @Autowired
    private CaseReportApplicationService reportApplication;

    @Autowired
    private TransitionApplicationService transitions;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 浏览与停留时长（需求 12.4 第 1 行）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 12.4：浏览不去重，同一账号打开三次就是三次")
    void 浏览不去重() {
        long caseId = 造案例("被反复打开的案例");

        interactions.recordView(caseId);
        interactions.recordView(caseId);
        interactions.recordView(caseId);

        assertThat(interactions.stats(caseId).viewCount())
                .describedAs("共享账号下系统不知道是谁，浏览次数的含义是「被打开了多少次」")
                .isEqualTo(3);
    }

    @Test
    @DisplayName("需求 12.4：单次停留时长超过 30 分钟按 30 分钟计")
    void 停留时长封顶() {
        long caseId = 造案例("挂了一夜的案例");
        long viewId = interactions.recordView(caseId);

        interactions.reportDuration(caseId, viewId, 8 * 60 * 60);

        assertThat(interactions.stats(caseId).readSeconds())
                .describedAs("一条 8 小时的记录会把平均阅读时长毁掉，而那个数字只是「有点高」")
                .isEqualTo(30 * 60);
    }

    @Test
    @DisplayName("时长为 0 或负数一律不落库，避免 0 秒记录把平均阅读时长拉低")
    void 非正时长丢弃() {
        long caseId = 造案例("秒退的案例");
        long viewId = interactions.recordView(caseId);

        interactions.reportDuration(caseId, viewId, 0);
        interactions.reportDuration(caseId, viewId, -5);

        CaseInteractionStats stats = interactions.stats(caseId);
        assertThat(stats.viewCount()).isEqualTo(1);
        assertThat(stats.readSeconds()).isZero();
        assertThat(stats.avgReadSeconds())
                .describedAs("有浏览无时长，平均值仍是「无数据」")
                .isNull();
    }

    @Test
    @DisplayName("回报时长时案例已删或记录已报过，静默返回，不给页面卸载请求留一片红")
    void 时长回报找不到记录时静默() {
        long caseId = 造案例("回报无着的案例");

        interactions.reportDuration(caseId, 99999L, 60);

        assertThat(interactions.stats(caseId).readSeconds()).isZero();
    }

    // -------------------------------------------------------------------------
    // 点赞（需求 12.4 第 2 行）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 12.4：点赞不去重、不可取消，同一账号点两次记两次")
    void 点赞不去重() {
        long caseId = 造案例("能连点的案例");

        assertThat(interactions.like(caseId)).isTrue();
        assertThat(interactions.like(caseId)).isTrue();

        assertThat(interactions.stats(caseId).likeCount()).isEqualTo(2);
        assertThat(CaseInteractionService.class.getMethods())
                .describedAs("系统无法判断当前使用者点没点过，不要补一个取消点赞接口")
                .noneMatch(method -> method.getName().equals("unlike"));
    }

    @Test
    @DisplayName("需求 12.4：同一 IP 一分钟内第 6 次点赞被静默丢弃——返回 false，不抛异常")
    void 点赞防刷静默丢弃() {
        long caseId = 造案例("被刷的案例");

        for (int i = 0; i < 5; i++) {
            assertThat(interactions.like(caseId)).isTrue();
        }

        assertThat(interactions.like(caseId))
                .describedAs("明确告诉刷子被限流了，等于告诉他隔一分钟再来")
                .isFalse();
        assertThat(interactions.stats(caseId).likeCount()).isEqualTo(5);
    }

    // -------------------------------------------------------------------------
    // 评论（需求 12.4 第 3 行、12.3 第 19 项）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 12.4：评论署名留空落 null，不写死「匿名」")
    void 评论署名可留空() {
        long caseId = 造案例("有评论的案例");

        interactions.comment(caseId, new CaseCommentForm("张三", "这个案例很有参考价值"));
        interactions.comment(caseId, new CaseCommentForm("   ", "没填署名的一条"));

        List<CaseComment> comments = interactions.comments(caseId);
        assertThat(comments).hasSize(2);
        assertThat(comments).extracting(CaseComment::signature)
                .describedAs("写死「匿名」之后，没填署名和真的叫匿名再也分不开")
                .containsExactlyInAnyOrder("张三", null);
    }

    @Test
    @DisplayName("需求 12.3 第 19 项：评论逻辑删除后不计入评论数，也不再出现在列表里")
    void 删除的评论不计数() {
        long caseId = 造案例("要删评论的案例");
        interactions.comment(caseId, new CaseCommentForm(null, "留着的评论"));
        interactions.comment(caseId, new CaseCommentForm(null, "要删掉的评论"));
        long commentId = interactions.comments(caseId).stream()
                .filter(c -> c.content().equals("要删掉的评论"))
                .findFirst().orElseThrow().id();

        interactions.deleteComment(caseId, commentId);

        assertThat(interactions.comments(caseId)).extracting(CaseComment::content)
                .containsExactly("留着的评论");
        assertThat(interactions.stats(caseId).commentCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT deleted FROM dtl_case_comment WHERE id = ?", Boolean.class, commentId))
                .describedAs("SEC2：一律逻辑删除")
                .isTrue();
    }

    // -------------------------------------------------------------------------
    // 总结报告（需求 12.6）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 12.6：自动生成的报告含三个段落，区间内的案例活动逐项计入")
    void 自动生成报告() {
        long caseId = 造案例("要进报告的案例");
        上架(caseId);
        interactions.recordView(caseId);
        interactions.like(caseId);
        interactions.comment(caseId, new CaseCommentForm(null, "进报告的评论"));

        long reportId = reportApplication.generate(new CaseReportForm(
                "本季度案例总结", LocalDate.now().minusDays(30), LocalDate.now(), null));

        var report = reports.get(reportId);
        assertThat(report.generateMode()).isEqualTo(CaseEnums.GENERATE_AUTO);
        assertThat(report.content())
                .contains("<h3>案例应用成果</h3>", "<h3>用户反馈</h3>", "<h3>培训执行情况</h3>")
                // 断言「不是 0」而不是「等于 1」：整个测试类共用一个库，同一区间里还有别的
                // 用例造的案例。写死 1 的话，往这个类里加一个用例就会把它弄红
                .doesNotContain("上架案例数：0", "浏览次数：0", "点赞量：0", "案例评论条数：0");
    }

    @Test
    @DisplayName("设计规范 3.3：区间内没有数据时计数写 0，而平均分写「—」")
    void 空区间的报告() {
        String content = reportApplication.preview(
                LocalDate.of(2000, 1, 1), LocalDate.of(2000, 1, 31));

        assertThat(content)
                .contains("新增案例数：0", "培训场次数：0")
                .describedAs("一条反馈都没有和平均分 0 分是两回事，后者根本不可能（评分 CHECK 是 1～5）")
                .contains("平均讲师评分：—");
    }

    @Test
    @DisplayName("需求 12.6：报告一经编辑，生成方式转为「手动编辑」")
    void 编辑后转手动() {
        long reportId = reportApplication.generate(new CaseReportForm(
                "会被改的报告", LocalDate.now().minusDays(7), LocalDate.now(), null));

        reports.update(reportId, new CaseReportForm("会被改的报告",
                LocalDate.now().minusDays(7), LocalDate.now(), "<p>运营手工补充的结论</p>"));

        var after = reports.get(reportId);
        assertThat(after.generateMode())
                .describedAs("还标着「系统自动生成」，读的人会以为里面的数字都是系统算的")
                .isEqualTo(CaseEnums.GENERATE_MANUAL);
        assertThat(after.content()).isEqualTo("<p>运营手工补充的结论</p>");
    }

    @Test
    @DisplayName("统计区间倒过来时当场拒绝——否则四段全是 0，报告看起来完全正常")
    void 区间倒置被拒() {
        assertThatThrownBy(() -> reportApplication.generate(new CaseReportForm(
                "倒着的报告", LocalDate.now(), LocalDate.now().minusDays(1), null)))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("结束日期不能早于开始日期");
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    /** 造一个刚由课程自动建出来的案例，停在初始状态。 */
    private long 造案例(String courseName) {
        String ownerNo = 造人员(courseName + "负责人", "客服中心");
        long courseId = jdbc.queryForObject("""
                INSERT INTO biz_course (course_no, course_name, review_track, domain_code, owner_no,
                                        initiated_date, expect_publish_date, validity_period,
                                        initiation_no, main_state, created_by)
                VALUES (?, ?, '内部端到端课程', ?, ?, CURRENT_DATE, CURRENT_DATE + 30,
                        '长期有效', ?, '推广', 'operator')
                RETURNING id
                """, Long.class, "KC" + System.nanoTime(), courseName, 启用中的作战单元编码(), ownerNo,
                "LI" + System.nanoTime());
        return application.createFromCourse(courseId, courseName, ownerNo, "客服中心",
                List.of(启用中的作战单元编码()));
    }

    /** 把案例推到「已上架」：开始整理 → 提交审核 → 审核通过。 */
    private void 上架(long caseId) {
        transit(caseId, "START_ORGANIZE");
        transit(caseId, "SUBMIT_AUDIT");
        application.recordAudit(caseId, new CaseAuditForm(造人员("报告用审核人", "AI 学院"),
                LocalDate.now(), null, CaseEnums.AUDIT_PASS, null));
        assertThat(cases.get(caseId).getPublishedAt()).isNotNull();
    }

    private void transit(long caseId, String action) {
        transitions.transit(new TransitCommand(CaseStateMachines.OBJECT_TYPE, caseId,
                CaseStateMachines.FIELD_CASE_STATE, action, null, null));
    }

    private String 启用中的作战单元编码() {
        return jdbc.queryForObject("""
                SELECT item_code FROM dict_item
                 WHERE dict_type = '作战单元' AND enabled = TRUE AND deleted = FALSE
                 ORDER BY id LIMIT 1
                """, String.class);
    }

    private String 造人员(String name, String dept) {
        String no = "E" + System.nanoTime();
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, ?, '两者', '在职', 'operator')
                """, no, name, dept);
        return no;
    }
}
