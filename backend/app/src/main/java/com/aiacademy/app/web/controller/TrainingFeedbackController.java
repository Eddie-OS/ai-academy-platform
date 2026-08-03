package com.aiacademy.app.web.controller;

import com.aiacademy.business.training.domain.FeedbackSummary;
import com.aiacademy.business.training.domain.TrainingFeedbackItem;
import com.aiacademy.business.training.service.TrainingFeedbackService;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 场次详情的「学员反馈」页签（需求 11.7，页面 P4-4）。
 *
 * <p><b>只有查看与运营备注两件事。</b>没有提交接口（规则 FB2）、没有修改正文的接口（规则 FB1）、
 * 没有评选优秀与激励（N20 推二期）。反馈从导入中心进来。
 */
@RestController
@RequestMapping("/api/training-sessions/{sessionId}/feedbacks")
public class TrainingFeedbackController {

    private final TrainingFeedbackService feedbacks;

    public TrainingFeedbackController(TrainingFeedbackService feedbacks) {
        this.feedbacks = feedbacks;
    }

    @GetMapping
    public R<PageResult<TrainingFeedbackItem>> list(
            @PathVariable long sessionId,
            @RequestParam(defaultValue = "1") @Min(1) int pageNum,
            @RequestParam(defaultValue = "20") @Min(1) @Max(200) int pageSize) {
        return R.ok(feedbacks.page(sessionId, pageNum, pageSize));
    }

    /** 汇总区：平均分、各分档条数、匿名条数。导入前的「已有 N 条」提示也取这里的 total（规则 FB5）。 */
    @GetMapping("/summary")
    public R<FeedbackSummary> summary(@PathVariable long sessionId) {
        return R.ok(feedbacks.summary(sessionId));
    }

    @WriteApi
    @PutMapping("/{feedbackId}/ops-remark")
    public R<Void> remark(@PathVariable long sessionId, @PathVariable long feedbackId,
                          @Valid @RequestBody RemarkRequest request) {
        feedbacks.updateOpsRemark(sessionId, feedbackId, request.opsRemark());
        return R.ok(null);
    }

    /** @param opsRemark 传 null 或空串即清空备注 */
    public record RemarkRequest(
            @Size(max = 2000, message = "运营备注不超过 2000 字")
            String opsRemark) {
    }
}
