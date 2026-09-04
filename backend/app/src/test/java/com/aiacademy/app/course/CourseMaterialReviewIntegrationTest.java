package com.aiacademy.app.course;

import com.aiacademy.app.application.CourseApplicationService;
import com.aiacademy.app.application.CourseReviewApplicationService;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.course.domain.CourseMaterial;
import com.aiacademy.business.course.domain.CourseMaterialVersion;
import com.aiacademy.business.course.domain.CourseMaterialVersionFile;
import com.aiacademy.business.course.domain.CourseReview;
import com.aiacademy.business.course.domain.CourseReviewForm;
import com.aiacademy.business.course.service.CourseMaterialService;
import com.aiacademy.business.course.service.CourseReviewService;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.business.course.service.CourseVersionService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.IllegalTransitionException;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
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
 * 课程材料、版本快照与多轮评审记录（阶段 2 A-3 批）。
 *
 * <p>本类钉住的是三条一旦破掉就<b>无法事后修复</b>的规则：R7（评审记录永远指向当时的材料）、
 * CK4（自检结果随材料一起快照）、议题 7（历史评审记录不可修改）。它们的共同点是错误不会
 * 当场暴露——数据照常写入、页面照常显示，等到半年后有人去翻某一轮评审看的是哪一版材料时，
 * 那份数据已经错了很久。
 */
class CourseMaterialReviewIntegrationTest extends IntegrationTest {

    @Autowired
    private CourseService courses;

    @Autowired
    private CourseApplicationService application;

    @Autowired
    private CourseMaterialService materials;

    @Autowired
    private CourseVersionService versions;

    @Autowired
    private CourseReviewService reviews;

    @Autowired
    private CourseReviewApplicationService reviewApplication;

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
    // 材料与版本快照
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 9.3.3：三类材料各自多附件，挂载后带出文件名与大小")
    void 挂载课程材料() {
        long id = application.initiate(表单("挂材料"));

        materials.attach(id, CourseEnums.MATERIAL_COURSEWARE, List.of(造附件("第一章.pptx", 2048)));
        materials.attach(id, CourseEnums.MATERIAL_COURSEWARE, List.of(造附件("第二章.pptx", 4096)));
        List<CourseMaterial> all = materials.attach(id, CourseEnums.MATERIAL_LESSON_PLAN,
                List.of(造附件("教案.docx", 1024)));

        assertThat(all).hasSize(3);
        assertThat(all).filteredOn(m -> m.materialType().equals(CourseEnums.MATERIAL_COURSEWARE))
                .extracting(CourseMaterial::fileName)
                .containsExactly("第一章.pptx", "第二章.pptx");
    }

    @Test
    @DisplayName("孤儿清理只认 sys_attachment_ref：材料必须在通用引用表上登记，否则文件会被物理删除")
    void 材料登记通用引用() {
        long id = application.initiate(表单("引用登记"));
        long attachmentId = 造附件("会被清理的课件.pptx", 512);

        materials.attach(id, CourseEnums.MATERIAL_COURSEWARE, List.of(attachmentId));

        assertThat(引用数(attachmentId))
                .describedAs("漏登记不会报错，只会让课件在 24 小时后消失")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("规则 F1：挂载时按材料类型复核大小上限，20MB 的教案挡在这里")
    void 教案大小上限() {
        long id = application.initiate(表单("大小上限"));
        long big = 造附件("超大教案.docx", 21L * 1024 * 1024);

        assertThatThrownBy(() -> materials.attach(id, CourseEnums.MATERIAL_LESSON_PLAN, List.of(big)))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("20MB");
    }

    @Test
    @DisplayName("需求 9.5.1：提交评审自动快照 V1，版本号递增且记录触发方式")
    void 提交评审自动快照() {
        long id = 推到自检("自动快照");
        materials.attach(id, CourseEnums.MATERIAL_COURSEWARE, List.of(造附件("课件 V1.pptx", 2048)));

        主状态(id, "SUBMIT_REVIEW");

        List<CourseMaterialVersion> list = versions.list(id);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).versionNo()).isEqualTo("V1");
        assertThat(list.get(0).triggerType()).isEqualTo(CourseVersionService.TRIGGER_AUTO);
        assertThat(list.get(0).boundReviewRound())
                .describedAs("需求 9.5.3 的版本历史列表要展示绑定的评审轮次")
                .isEqualTo(1);
        assertThat(courses.get(id).getCurrentMaterialVersion()).isEqualTo("V1");
    }

    @Test
    @DisplayName("规则 R7：版本快照复制当时的文件清单，材料随后被移除也不影响历史版本")
    void 快照不受后续修改影响() {
        long id = 推到自检("快照隔离");
        long attachmentId = 造附件("评审时的课件.pptx", 2048);
        List<CourseMaterial> before = materials.attach(id, CourseEnums.MATERIAL_COURSEWARE,
                List.of(attachmentId));

        主状态(id, "SUBMIT_REVIEW");
        long versionId = versions.list(id).get(0).id();

        materials.detach(id, before.get(0).id());

        assertThat(materials.list(id)).isEmpty();
        List<CourseMaterialVersionFile> files = versions.files(versionId);
        assertThat(files).hasSize(1);
        assertThat(files.get(0).fileNameSnapshot()).isEqualTo("评审时的课件.pptx");
        assertThat(引用数(attachmentId))
                .describedAs("当前材料的引用解掉后，版本自己那条引用必须还在，"
                        + "否则孤儿清理会把评审时的课件物理删除")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("规则 CK4：提交评审快照材料时，自检结果一并快照")
    void 自检结果随快照留档() {
        long id = 推到自检("自检快照");
        造自检记录(id, "课程有没有必要开发？开发原因", true, "线下已确认无同类课程");

        主状态(id, "SUBMIT_REVIEW");

        long versionId = versions.list(id).get(0).id();
        List<Map<String, Object>> snapshot = versions.selfcheckSnapshot(versionId);
        assertThat(snapshot).hasSize(1);
        assertThat(snapshot.get(0).get("item_text_snapshot"))
                .isEqualTo("课程有没有必要开发？开发原因");
        assertThat(snapshot.get(0).get("note")).isEqualTo("线下已确认无同类课程");
    }

    @Test
    @DisplayName("需求 9.5.1：运营也可以手动创建快照，触发方式与自动快照区分开")
    void 手动快照() {
        long id = application.initiate(表单("手动快照"));
        materials.attach(id, CourseEnums.MATERIAL_COURSEWARE, List.of(造附件("初稿.pptx", 1024)));

        CourseMaterialVersion version = versions.snapshot(id, CourseVersionService.TRIGGER_MANUAL,
                "初稿完成，先留个底");

        assertThat(version.versionNo()).isEqualTo("V1");
        assertThat(version.triggerType()).isEqualTo(CourseVersionService.TRIGGER_MANUAL);
        assertThat(version.remark()).isEqualTo("初稿完成，先留个底");
        assertThat(version.boundReviewRound()).isNull();
    }

    // -------------------------------------------------------------------------
    // 评审记录
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("需求 9.6.1：提交评审开一轮记录，轮次与绑定版本在创建时就写死")
    void 提交评审开一轮记录() {
        long id = 推到自检("开评审轮次");
        materials.attach(id, CourseEnums.MATERIAL_COURSEWARE, List.of(造附件("送评课件.pptx", 2048)));

        主状态(id, "SUBMIT_REVIEW");

        List<CourseReview> list = reviews.listByCourse(id);
        assertThat(list).hasSize(1);
        CourseReview round1 = list.get(0);
        assertThat(round1.roundNo()).isEqualTo(1);
        assertThat(round1.boundVersionNo()).isEqualTo("V1");
        assertThat(round1.versionId()).isEqualTo(versions.list(id).get(0).id());
        assertThat(round1.reviewResult()).isNull();

        assertThat(jdbc.queryForMap("""
                SELECT from_state, to_state FROM audit_state_log
                 WHERE object_type = ? AND object_id = ?
                """, CourseRecordStateMachines.REVIEW_OBJECT_TYPE, round1.id()))
                .describedAs("记录状态是需求 5.5 的一个状态机，「（空）→ 待录入结论」也要留痕")
                .containsEntry("from_state", null)
                .containsEntry("to_state", "待录入结论");
    }

    @Test
    @DisplayName("需求 5.5：录入结论=通过，记录转已完成并把课程主状态推到试讲")
    void 结论通过驱动主状态() {
        long id = 推到自检("结论通过");
        主状态(id, "SUBMIT_REVIEW");
        long reviewId = reviews.listByCourse(id).get(0).id();

        reviewApplication.recordConclusion(reviewId, 结论(CourseEnums.REVIEW_PASS));

        assertThat(reviews.require(reviewId).recordState()).isEqualTo("已完成");
        assertThat(courses.get(id).getMainState()).isEqualTo("试讲");
        assertThat(courses.get(id).getTrialState())
                .describedAs("需求 5.3.1：进入试讲同时把试讲子状态置成「待试讲」")
                .isEqualTo("待试讲");
    }

    @Test
    @DisplayName("需求 5.5：结论=不通过·修改后重新评审，课程回到优化；再次提交产生 V2 与第 2 轮")
    void 多轮评审各自绑定各自的版本() {
        long id = 推到自检("多轮评审");
        materials.attach(id, CourseEnums.MATERIAL_COURSEWARE, List.of(造附件("初版课件.pptx", 1024)));
        主状态(id, "SUBMIT_REVIEW");
        long round1 = reviews.listByCourse(id).get(0).id();

        reviewApplication.recordConclusion(round1, 结论(CourseEnums.REVIEW_REJECT_REVISE));
        assertThat(courses.get(id).getMainState()).isEqualTo("优化");

        materials.attach(id, CourseEnums.MATERIAL_COURSEWARE, List.of(造附件("修订版课件.pptx", 2048)));
        主状态(id, "RESUBMIT_REVIEW");

        assertThat(versions.list(id)).extracting(CourseMaterialVersion::versionNo)
                .containsExactly("V2", "V1");
        List<CourseReview> list = reviews.listByCourse(id);
        assertThat(list).extracting(CourseReview::roundNo).containsExactly(2, 1);
        assertThat(list.get(0).boundVersionNo()).isEqualTo("V2");
        assertThat(list.get(1).boundVersionNo())
                .describedAs("规则 R7：第 1 轮永远指向当时那版材料，不随新版本漂移")
                .isEqualTo("V1");
        assertThat(versions.files(list.get(1).versionId()))
                .extracting(CourseMaterialVersionFile::fileNameSnapshot)
                .containsExactly("初版课件.pptx");
    }

    @Test
    @DisplayName("议题 7：已完成的评审记录不允许再改")
    void 历史评审记录只读() {
        long id = 推到自检("历史只读");
        主状态(id, "SUBMIT_REVIEW");
        long reviewId = reviews.listByCourse(id).get(0).id();
        reviewApplication.recordConclusion(reviewId, 结论(CourseEnums.REVIEW_PASS));

        assertThatThrownBy(() -> reviewApplication.recordConclusion(reviewId,
                结论(CourseEnums.REVIEW_REJECT_CLOSE)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.BIZ_RULE_VIOLATED));

        assertThat(reviews.require(reviewId).reviewResult()).isEqualTo(CourseEnums.REVIEW_PASS);
    }

    @Test
    @DisplayName("规则 K2：同一个结论再提交一次是双击，按重复提交处理而不是「不允许修改」")
    void 同结论重复提交按幂等处理() {
        long id = 推到自检("双击录结论");
        主状态(id, "SUBMIT_REVIEW");
        long reviewId = reviews.listByCourse(id).get(0).id();
        reviewApplication.recordConclusion(reviewId, 结论(CourseEnums.REVIEW_PASS));

        assertThatThrownBy(() -> reviewApplication.recordConclusion(reviewId, 结论(CourseEnums.REVIEW_PASS)))
                .isInstanceOf(BizException.class)
                .describedAs("DUPLICATE_SUBMIT 前端静默忽略，运营看到的就是一次正常的保存")
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.DUPLICATE_SUBMIT));
    }

    @Test
    @DisplayName("规则 C3：课程已不在评审决策时录结论，整笔回滚，不留下对不上的记录")
    void 驱动不了主状态时整笔回滚() {
        long id = 推到自检("驱动失败");
        主状态(id, "SUBMIT_REVIEW");
        long reviewId = reviews.listByCourse(id).get(0).id();
        // 绕过评审记录直接推进主状态：运营在统一转换接口上也能这么做。课程从此在「试讲」，
        // 而「不通过·关闭课程开发」要求它还在「评审决策」
        主状态(id, "REVIEW_PASS");

        assertThatThrownBy(() -> reviewApplication.recordConclusion(reviewId,
                结论(CourseEnums.REVIEW_REJECT_CLOSE)))
                .isInstanceOf(IllegalTransitionException.class);

        CourseReview review = reviews.require(reviewId);
        assertThat(review.reviewResult())
                .describedAs("结论写进去了但状态没跟着走，就会留下一条谁也解释不了的记录")
                .isNull();
        assertThat(review.recordState()).isEqualTo("待录入结论");
    }

    @Test
    @DisplayName("需求 9.6.1：评审结果只能取三值之一，「有条件通过」在一期不存在")
    void 评审结果取值受限() {
        long id = 推到自检("结果取值");
        主状态(id, "SUBMIT_REVIEW");
        long reviewId = reviews.listByCourse(id).get(0).id();

        CourseReviewForm form = new CourseReviewForm(List.of("线下会议"), LocalDate.now(),
                "张三、李四", "有条件通过", "意见", null);
        assertThatThrownBy(() -> reviewApplication.recordConclusion(reviewId, form))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("评审结果");
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private CourseForm 表单(String name) {
        return new CourseForm(name + System.nanoTime(), "内部端到端课程", "COURSE", ownerNo,
                LocalDate.now().minusDays(30), LocalDate.now().plusDays(30),
                name + " 的简介", "一线客服", new BigDecimal("4.5"), null, null, null,
                "12 个月", "https://example.com/course", List.of("推荐"));
    }

    private CourseReviewForm 结论(String result) {
        return new CourseReviewForm(List.of("线下会议", "集体评审"), LocalDate.now(),
                "张三、李四、王五", result, "内容完整，节奏偏快", "第 3 章示例需要补充");
    }

    /** 立项 → 开发 → 自检，即可执行「提交评审」。 */
    private long 推到自检(String name) {
        long id = application.initiate(表单(name));
        主状态(id, "START_DEVELOP");
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, id,
                CourseStateMachines.FIELD_DEV_STATE, "START_DEVELOP", null, null));
        主状态(id, "ENTER_SELF_CHECK");
        return id;
    }

    private void 主状态(long id, String action) {
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, id,
                CourseStateMachines.FIELD_MAIN_STATE, action, null, null));
    }

    private long 造附件(String fileName, long size) {
        return jdbc.queryForObject("""
                INSERT INTO sys_attachment (file_name, file_size, content_type, storage_path, created_by)
                VALUES (?, ?, 'application/octet-stream', ?, 'operator')
                RETURNING id
                """, Long.class, fileName, size, "attachment/course/test/" + System.nanoTime());
    }

    private void 造自检记录(long courseId, String itemText, boolean checked, String note) {
        Long itemId = jdbc.queryForObject("SELECT MIN(id) FROM cfg_selfcheck_item", Long.class);
        if (itemId == null) {
            itemId = jdbc.queryForObject("""
                    INSERT INTO cfg_selfcheck_item (group_name, seq, item_text, created_by)
                    VALUES ('A 立项必要性', 9001, ?, 'operator') RETURNING id
                    """, Long.class, itemText);
        }
        jdbc.update("""
                INSERT INTO dtl_course_selfcheck (course_id, item_id, item_text_snapshot, checked,
                                                  note, created_by)
                VALUES (?, ?, ?, ?, ?, 'operator')
                """, courseId, itemId, itemText, checked, note);
    }

    private int 引用数(long attachmentId) {
        Integer count = jdbc.queryForObject("""
                SELECT COUNT(*) FROM sys_attachment_ref
                 WHERE attachment_id = ? AND deleted = FALSE
                """, Integer.class, attachmentId);
        return count == null ? 0 : count;
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
