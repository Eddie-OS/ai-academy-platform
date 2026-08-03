package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.CourseReviewApplicationService;
import com.aiacademy.app.web.dto.CourseReviewVO;
import com.aiacademy.business.course.domain.CourseReviewForm;
import com.aiacademy.business.course.service.CourseReviewService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 课程评审记录（需求 9.6，页面 P2-2 的「评审记录」页签）。
 *
 * <p><b>只有两个接口：查列表、录一次结论。</b>没有新建（评审记录由课程「提交评审」的副作用产生，
 * 轮次是算出来的）、没有编辑、没有删除（议题 7：历史不被覆盖）。这三个缺口是需求，不是没做完。
 */
@RestController
public class CourseReviewController {

    private final CourseReviewService reviews;
    private final CourseReviewApplicationService application;

    public CourseReviewController(CourseReviewService reviews,
                                  CourseReviewApplicationService application) {
        this.reviews = reviews;
        this.application = application;
    }

    /** 某门课程的全部评审记录，轮次倒序（需求 9.6.1 界面要求）。 */
    @GetMapping("/api/courses/{courseId}/reviews")
    public R<List<CourseReviewVO>> listByCourse(@PathVariable long courseId) {
        return R.ok(reviews.listByCourse(courseId).stream().map(CourseReviewVO::of).toList());
    }

    @GetMapping("/api/course-reviews/{reviewId}")
    public R<CourseReviewVO> detail(@PathVariable long reviewId) {
        return R.ok(CourseReviewVO.of(reviews.require(reviewId)));
    }

    /**
     * 录入评审结论（需求 9.6.1 第 5～10 项）。
     *
     * <p>这一次调用同时做三件事：写结论字段、把记录状态推到「已完成」、按结论驱动课程主状态
     * （需求 5.5）。课程当前不在「评审决策」时整笔失败并返回 {@code ILLEGAL_TRANSITION}——
     * 规则 C3 要求非法转换硬阻断在服务层。
     */
    @WriteApi
    @PostMapping("/api/course-reviews/{reviewId}/conclusion")
    public R<Void> recordConclusion(@PathVariable long reviewId,
                                    @Valid @RequestBody CourseReviewForm form) {
        application.recordConclusion(reviewId, form);
        return R.ok(null);
    }
}
