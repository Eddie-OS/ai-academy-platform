package com.aiacademy.app.application.effect;

import com.aiacademy.business.course.service.CourseVersionService;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import org.springframework.stereotype.Component;

/**
 * 副作用 {@code SNAPSHOT_MATERIAL}：提交评审时自动快照材料版本（需求 9.5.1，规则 R7）。
 *
 * <p>挂在「自检 → 评审决策」与「优化 → 评审决策」两条转换上，因此每一轮评审都有自己的版本。
 * 快照必须排在 {@code CREATE_REVIEW_ROUND} 之前——评审记录绑定的是「课程当前最新版本」，
 * 顺序反了就会绑到上一轮的版本上。顺序由转换定义里的副作用清单保证
 * （{@code EffectDispatcher} 按声明顺序执行）。
 */
@Component
public class SnapshotMaterialEffectHandler implements EffectHandler {

    private final CourseVersionService versions;

    public SnapshotMaterialEffectHandler(CourseVersionService versions) {
        this.versions = versions;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.SNAPSHOT_MATERIAL.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (!CourseStateMachines.OBJECT_TYPE.equals(context.objectType())) {
            throw new IllegalStateException("SNAPSHOT_MATERIAL 只用于课程，收到 " + context.objectType());
        }
        versions.snapshot(context.objectId(), CourseVersionService.TRIGGER_AUTO,
                "「%s」自动快照".formatted(context.transition().actionLabel()));
    }
}
