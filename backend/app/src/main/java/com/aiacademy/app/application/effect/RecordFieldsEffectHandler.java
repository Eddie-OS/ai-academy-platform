package com.aiacademy.app.application.effect;

import com.aiacademy.business.course.domain.CourseReview;
import com.aiacademy.business.course.domain.CourseTrial;
import com.aiacademy.business.course.service.CourseReviewService;
import com.aiacademy.business.course.service.CourseTrialService;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import org.springframework.stereotype.Component;

/**
 * 副作用 {@code SET_ROUND_NO}（评审记录与试讲记录）与 {@code BIND_MATERIAL_VERSION}（仅评审记录）：
 * 记录创建时写定轮次与绑定的材料版本（需求 5.5、5.6、9.6.1、9.7.1）。
 *
 * <p><b>这两件事发生在 INSERT 里，本处理器做的是复核而不是补写。</b>轮次带 UNIQUE
 * (course_id, round_no)，不可能先插一条空的再由副作用回填。但副作用码不能因此当作空转跳过：
 * 需求 5.5／5.6 的副作用列写着这两项，登记一个只做复核的处理器，等于把「创建记录时必须写死
 * 轮次与版本」这条约束钉在状态机这一侧。有人改了创建逻辑却漏掉其中一项时，这里当场抛错，
 * 而不是等到半年后有人问「第 3 轮评的是哪一版材料」。
 *
 * <p>{@code BIND_MATERIAL_VERSION} 允许版本为空：课程可以一个附件都没传就提交评审（材料三类
 * 全是选填），此时快照出来的是一个空版本。所以复核的是「版本关联与版本号快照同时有、或同时无」。
 */
@Component
public class RecordFieldsEffectHandler implements EffectHandler {

    private final CourseReviewService reviews;
    private final CourseTrialService trials;

    public RecordFieldsEffectHandler(CourseReviewService reviews, CourseTrialService trials) {
        this.reviews = reviews;
        this.trials = trials;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.SET_ROUND_NO.equals(effectCode) || Effect.BIND_MATERIAL_VERSION.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (Effect.SET_ROUND_NO.equals(effectCode)) {
            checkRoundNo(context);
            return;
        }
        if (!CourseRecordStateMachines.REVIEW_OBJECT_TYPE.equals(context.objectType())) {
            throw new IllegalStateException("BIND_MATERIAL_VERSION 只用于评审记录，收到 "
                    + context.objectType());
        }
        CourseReview review = reviews.require(context.objectId());
        boolean hasVersionId = review.versionId() != null;
        boolean hasVersionNo = review.boundVersionNo() != null;
        if (hasVersionId != hasVersionNo) {
            throw new IllegalStateException(("评审记录 %d 的材料版本绑定不完整：version_id=%s，"
                    + "bound_version_no=%s。两者必须同时写入（规则 R7）")
                    .formatted(context.objectId(), review.versionId(), review.boundVersionNo()));
        }
    }

    private void checkRoundNo(EffectContext context) {
        Integer roundNo = switch (context.objectType()) {
            case CourseRecordStateMachines.REVIEW_OBJECT_TYPE -> reviews.require(context.objectId()).roundNo();
            case CourseRecordStateMachines.TRIAL_OBJECT_TYPE -> {
                CourseTrial trial = trials.require(context.objectId());
                yield trial.roundNo();
            }
            default -> throw new IllegalStateException(
                    "SET_ROUND_NO 只用于评审记录与试讲记录，收到 " + context.objectType());
        };
        if (roundNo == null || roundNo < 1) {
            throw new IllegalStateException("%s#%d 创建时没有写入轮次"
                    .formatted(context.objectType(), context.objectId()));
        }
    }
}
