package com.aiacademy.app.application.effect;

import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.repository.TaskWriteMapper;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * {@link Effect#CLOSE_RELATED_TASKS}：业务对象进入终态时，将其下未完成任务置「已关闭」
 * （需求 13.1.2 自动关闭、任务状态机 5.10 的 CLOSE 动作）。
 *
 * <p>只关「待处理／处理中」；「已完成」保留——运营已经点过完成，不应被对象关闭抹掉。
 */
@Component
public class CloseRelatedTasksEffectHandler implements EffectHandler {

    private static final Logger log = LoggerFactory.getLogger(CloseRelatedTasksEffectHandler.class);

    private final TaskWriteMapper tasks;
    private final TransitionApplicationService transitions;

    public CloseRelatedTasksEffectHandler(TaskWriteMapper tasks,
                                          @Lazy TransitionApplicationService transitions) {
        this.tasks = tasks;
        this.transitions = transitions;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.CLOSE_RELATED_TASKS.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        List<Long> openIds = tasks.findOpenTaskIds(
                context.objectType(), context.objectId(),
                TaskStateMachine.STATE_PENDING, TaskStateMachine.STATE_IN_PROGRESS);
        for (Long taskId : openIds) {
            transitions.transit(new TransitCommand(
                    TaskStateMachine.OBJECT_TYPE, taskId, TaskStateMachine.FIELD_TASK_STATE, "CLOSE",
                    null, "业务对象进入终态，自动关闭未完成任务"));
        }
        if (!openIds.isEmpty()) {
            log.info("关闭 {}#{} 下未完成任务 {} 条", context.objectType(), context.objectId(),
                    openIds.size());
        }
    }
}
