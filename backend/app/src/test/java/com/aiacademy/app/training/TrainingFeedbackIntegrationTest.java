package com.aiacademy.app.training;

import com.aiacademy.business.training.domain.FeedbackSummary;
import com.aiacademy.business.training.domain.TrainingFeedbackItem;
import com.aiacademy.business.training.service.TrainingFeedbackService;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.exception.NotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 学员反馈的查看与运营备注（阶段 2 C-3 批，需求 11.7）。
 *
 * <p>反馈只能由导入产生，因此这里用 SQL 直接造数据——走一遍导入流程测的是导入框架，
 * 那部分在阶段 1 已有测试。
 */
class TrainingFeedbackIntegrationTest extends TrainingTestBase {

    @Autowired
    private TrainingFeedbackService feedbacks;

    @Test
    @DisplayName("需求 11.7.2 第 3 项：留空工号就是匿名，库里存的是 NULL 而不是「存了但不显示」")
    void 匿名反馈存空工号() {
        long sessionId = 造场次("匿名");
        造反馈(sessionId, null, 5, "讲得好");

        TrainingFeedbackItem item = feedbacks.page(sessionId, 1, 20).records().get(0);

        assertThat(item.submitterNo()).isNull();
        assertThat(item.anonymous()).isTrue();
    }

    @Test
    @DisplayName("规则 FB3：匿名反馈同样计入平均分与分档，匿名只影响能不能看到是谁写的")
    void 匿名计入平均分() {
        long sessionId = 造场次("平均分");
        造反馈(sessionId, "E001", 5, "实名 5 分");
        造反馈(sessionId, null, 3, "匿名 3 分");

        FeedbackSummary summary = feedbacks.summary(sessionId);

        assertThat(summary.total()).isEqualTo(2);
        assertThat(summary.averageScore()).isEqualByComparingTo(new BigDecimal("4.0"));
        assertThat(summary.score5()).isEqualTo(1);
        assertThat(summary.score3()).isEqualTo(1);
        assertThat(summary.anonymousCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("需求 3.3：没有反馈时平均分是「—」而不是 0 分——0 分是个真实的差评")
    void 无反馈时平均分为空() {
        long sessionId = 造场次("无反馈");

        FeedbackSummary summary = feedbacks.summary(sessionId);

        assertThat(summary.total()).isZero();
        assertThat(summary.averageScore()).isNull();
    }

    @Test
    @DisplayName("规则 FB4：同一场次多次导入是追加，反馈没有唯一键——匿名记录无法判断重复")
    void 多次导入追加() {
        long sessionId = 造场次("追加");
        造反馈(sessionId, null, 4, "同样的内容");
        造反馈(sessionId, null, 4, "同样的内容");

        assertThat(feedbacks.summary(sessionId).total()).isEqualTo(2);
    }

    @Test
    @DisplayName("需求 11.7.2 第 10、11 项：运营备注写入时记备注时间，清空时一并清掉")
    void 运营备注与备注时间() {
        long sessionId = 造场次("运营备注");
        造反馈(sessionId, null, 2, "节奏太快");
        long feedbackId = feedbacks.page(sessionId, 1, 20).records().get(0).id();

        feedbacks.updateOpsRemark(sessionId, feedbackId, "已与讲师沟通，下一场放慢");
        TrainingFeedbackItem remarked = feedbacks.page(sessionId, 1, 20).records().get(0);
        assertThat(remarked.opsRemark()).isEqualTo("已与讲师沟通，下一场放慢");
        assertThat(remarked.remarkedAt()).isNotNull();

        feedbacks.updateOpsRemark(sessionId, feedbackId, "  ");
        TrainingFeedbackItem cleared = feedbacks.page(sessionId, 1, 20).records().get(0);
        assertThat(cleared.opsRemark()).isNull();
        assertThat(cleared.remarkedAt()).isNull();
    }

    @Test
    @DisplayName("规则 FB1：反馈正文不可修改——服务层根本没有改正文的方法，运营备注改的是另一列")
    void 反馈正文不可修改() {
        long sessionId = 造场次("正文不可改");
        造反馈(sessionId, null, 3, "原始正文");
        long feedbackId = feedbacks.page(sessionId, 1, 20).records().get(0).id();

        feedbacks.updateOpsRemark(sessionId, feedbackId, "备注");

        assertThat(feedbacks.page(sessionId, 1, 20).records().get(0).content())
                .isEqualTo("原始正文");
    }

    @Test
    @DisplayName("给别的场次的反馈加备注要 404")
    void 跨场次备注被拒绝() {
        long sessionA = 造场次("反馈甲");
        long sessionB = 造场次("反馈乙");
        造反馈(sessionA, null, 4, "内容");
        long feedbackId = feedbacks.page(sessionA, 1, 20).records().get(0).id();

        assertThatThrownBy(() -> feedbacks.updateOpsRemark(sessionB, feedbackId, "备注"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("反馈列表分页，按导入时间倒序")
    void 列表分页() {
        long sessionId = 造场次("分页");
        for (int i = 0; i < 5; i++) {
            造反馈(sessionId, null, 4, "第 " + i + " 条");
        }

        PageResult<TrainingFeedbackItem> page = feedbacks.page(sessionId, 2, 2);

        assertThat(page.total()).isEqualTo(5);
        assertThat(page.records()).hasSize(2);
    }

    private void 造反馈(long sessionId, String submitterNo, int score, String content) {
        jdbc.update("""
                INSERT INTO dtl_training_feedback (session_id, submitter_no, submitter_name,
                                                   score, content, import_batch_no, created_by)
                VALUES (?, ?, ?, ?, ?, 'FB-BATCH', 'OPS')
                """, sessionId, submitterNo, submitterNo == null ? null : "学员", score, content);
    }
}
