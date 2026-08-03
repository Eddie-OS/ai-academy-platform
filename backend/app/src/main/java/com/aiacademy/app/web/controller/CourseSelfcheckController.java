package com.aiacademy.app.web.controller;

import com.aiacademy.business.course.domain.CourseSelfcheckView;
import com.aiacademy.business.course.service.CourseSelfcheckService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 课程自检 CheckList（需求 9.4，页面 P2-2 的自检页签）。
 *
 * <p>返回体里带完成度（{@code completedCount / totalCount}），页签标题按需求 9.4.3 CK1 显示成
 * 「CheckList 自检 9/14」。<b>它只是一个数字</b>：CK3 说未达 100% 时提交评审弹提示但允许继续，
 * CK6 说它不进任何指标、不参与三色灯判定。
 */
@RestController
@RequestMapping("/api/courses/{courseId}/selfcheck")
public class CourseSelfcheckController {

    private final CourseSelfcheckService selfchecks;

    public CourseSelfcheckController(CourseSelfcheckService selfchecks) {
        this.selfchecks = selfchecks;
    }

    @GetMapping
    public R<CourseSelfcheckView> view(@PathVariable long courseId) {
        return R.ok(selfchecks.view(courseId));
    }

    /**
     * 保存勾选结果。<b>逐条覆盖，没传的题目保持原样</b>：自检是边填边存的，一次全量提交会让
     * 两名运营同时填不同分组时互相清空对方的结果。
     */
    @WriteApi
    @PutMapping
    public R<CourseSelfcheckView> save(@PathVariable long courseId,
                                       @Valid @RequestBody SaveRequest request) {
        List<CourseSelfcheckService.Answer> answers = request.answers().stream()
                .map(a -> new CourseSelfcheckService.Answer(a.itemId(), a.checked(), a.note()))
                .toList();
        return R.ok(selfchecks.save(courseId, answers));
    }

    public record SaveRequest(
            @NotEmpty(message = "请至少提交一条勾选结果")
            List<AnswerRequest> answers) {
    }

    public record AnswerRequest(
            long itemId,
            boolean checked,
            @Size(max = 500, message = "说明文本不超过 500 字")
            String note) {
    }
}
