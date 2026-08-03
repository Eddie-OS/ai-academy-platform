package com.aiacademy.business.course.service;

import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseMaterialVersion;
import com.aiacademy.business.course.domain.CourseReview;
import com.aiacademy.business.course.domain.CourseReviewForm;
import com.aiacademy.business.course.repository.CourseMapper;
import com.aiacademy.business.course.repository.CourseReviewMapper;
import com.aiacademy.business.course.repository.CourseVersionMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.common.json.JsonArrays;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 课程评审记录（需求 9.6）。多轮独立留档、不设上限、历史不被覆盖（议题 7）。
 *
 * <p><b>这里没有「修改已完成的评审记录」，也没有删除。</b>需求 9.6.1 表末写死了「历史记录只读，
 * 任何角色不得修改或删除已完成的评审记录」——如果允许改，那条评审记录就不再是「当时线下会议
 * 的结论」，而是一个可以被后来的判断覆盖的字段。
 *
 * <p><b>一期不做</b>（议题 10、11）：专家人数校验、多人结论汇总、「有条件通过」结论、
 * 专家回避校验。结论就是运营照着线下会议纪要录进来的一句话。
 */
@Service
public class CourseReviewService {

    private final CourseReviewMapper reviews;
    private final CourseVersionMapper versions;
    private final CourseMapper courses;
    private final StateMachineRegistry stateMachines;

    public CourseReviewService(CourseReviewMapper reviews, CourseVersionMapper versions,
                               CourseMapper courses, StateMachineRegistry stateMachines) {
        this.reviews = reviews;
        this.versions = versions;
        this.courses = courses;
        this.stateMachines = stateMachines;
    }

    /**
     * 建一条待录入结论的评审记录（需求 5.5 的「空 → 待录入结论」）。
     *
     * <p>由「课程提交评审 / 再次提交评审」的副作用调用，不对外开接口：评审记录只能由课程状态
     * 转换产生，手工建一条会让轮次与课程状态对不上。
     *
     * <p>绑定的材料版本取课程当前最新版本（规则 R7）。提交评审这条转换的副作用顺序是
     * 「先快照、后建评审记录」，所以这里读到的就是刚刚快照出来的那一版。
     */
    @Transactional
    public long createRound(long courseId) {
        if (courses.lockById(courseId) == null) {
            throw new NotFoundException("课程不存在或已删除：" + courseId);
        }
        int roundNo = reviews.nextRoundNo(courseId);
        CourseMaterialVersion version = versions.findLatest(courseId);

        return reviews.insert(courseId, roundNo,
                version == null ? null : version.id(),
                version == null ? null : version.versionNo(),
                pendingState(),
                OperatorContext.current().account().name());
    }

    /**
     * 录入评审结论（需求 9.6.1 第 5～10 项）。只写字段，记录状态与课程主状态由调用方按状态机推进。
     *
     * <p>影响行数为 0 只可能是记录已经是「已完成」——历史记录只读（议题 7）。
     */
    @Transactional
    public void recordConclusion(long reviewId, CourseReviewForm form) {
        CourseReview review = require(reviewId);
        checkEnums(form);

        int updated = reviews.recordConclusion(reviewId,
                JsonArrays.toJson(form.reviewForms()),
                form.reviewDate(),
                form.participants(),
                form.reviewResult(),
                form.reviewOpinion(),
                form.issueList(),
                OperatorContext.current().account().name(),
                pendingState());
        if (updated == 0) {
            // 记录已经是「已完成」。分两种情况：同一个结论再提交一次是双击（规则 K2，静默当成功）；
            // 换一个结论提交则是在改历史，必须拒（议题 7）。合成一个 BIZ_RULE_VIOLATED 会让运营
            // 双击一下就看到一句「不允许修改」的红框，而他并没有想改什么
            if (form.reviewResult().equals(review.reviewResult())) {
                throw new BizException(ErrorCode.DUPLICATE_SUBMIT,
                        ErrorCode.DUPLICATE_SUBMIT.defaultMessage());
            }
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "第 %d 轮评审记录已录入结论「%s」，历史评审记录不允许修改"
                            .formatted(review.roundNo(), review.reviewResult()));
        }
    }

    @Transactional(readOnly = true)
    public List<CourseReview> listByCourse(long courseId) {
        return reviews.findByCourse(courseId);
    }

    @Transactional(readOnly = true)
    public CourseReview require(long reviewId) {
        CourseReview review = reviews.findById(reviewId);
        if (review == null) {
            throw new NotFoundException("评审记录不存在或已删除：" + reviewId);
        }
        return review;
    }

    /**
     * 评审记录的初始状态「待录入结论」，从状态机的「（空）→ 建评审记录」这条转换取。
     *
     * <p>两处用到：建记录时落库的初始值，以及录入结论时 UPDATE 的 WHERE 条件（只有还没录结论的
     * 记录能改）。都从状态机取而不是写字面量——状态名改了这里跟着变，写死则会在转换表改名后
     * 变成一条永远匹配不到的 WHERE（出口准则 E2-6）。
     */
    private String pendingState() {
        return stateMachines.require(CourseRecordStateMachines.REVIEW_OBJECT_TYPE,
                CourseRecordStateMachines.FIELD_REVIEW_STATE, null,
                CourseRecordStateMachines.ACTION_CREATE_BY_COURSE_SUBMIT).to();
    }

    private static void checkEnums(CourseReviewForm form) {
        if (!CourseEnums.REVIEW_RESULTS.contains(form.reviewResult())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "评审结果只能是 %s，收到「%s」".formatted(CourseEnums.REVIEW_RESULTS, form.reviewResult()));
        }
        if (form.reviewForms() != null) {
            for (String reviewForm : form.reviewForms()) {
                if (!CourseEnums.REVIEW_FORMS.contains(reviewForm)) {
                    throw new BizException(ErrorCode.PARAM_INVALID,
                            "评审形式只能是 %s，收到「%s」".formatted(CourseEnums.REVIEW_FORMS, reviewForm));
                }
            }
        }
    }
}
