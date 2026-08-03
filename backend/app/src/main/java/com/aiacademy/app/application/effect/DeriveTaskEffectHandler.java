package com.aiacademy.app.application.effect;

import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.repository.TaskWriteMapper;
import com.aiacademy.app.repository.TaskWriteMapper.ObjectTaskSource;
import com.aiacademy.app.repository.TaskWriteMapper.TaskInsert;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.dict.domain.TaskDeriveRule;
import com.aiacademy.platform.dict.repository.TaskDeriveRuleMapper;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * {@code DERIVE_TASK:{任务类型}}：按 {@code cfg_task_derive_rule} 写一条 {@code sys_task}
 * （需求 13.1.2、开发 5.9.1）。
 *
 * <p>课程开发那条的截止日取 {@code expect_publish_date} 本身（不是「立项日 + N 天」）——
 * 这是派生规则里最容易算错的一点。
 */
@Component
public class DeriveTaskEffectHandler implements EffectHandler {

    private static final Logger log = LoggerFactory.getLogger(DeriveTaskEffectHandler.class);
    private static final String PREFIX = "DERIVE_TASK:";
    private static final String OBJECT_FIELD_PREFIX = "OBJECT_FIELD:";

    private final TaskDeriveRuleMapper rules;
    private final TaskWriteMapper tasks;
    private final TransitionApplicationService transitions;

    public DeriveTaskEffectHandler(TaskDeriveRuleMapper rules, TaskWriteMapper tasks,
                                   @Lazy TransitionApplicationService transitions) {
        this.rules = rules;
        this.tasks = tasks;
        this.transitions = transitions;
    }

    @Override
    public boolean supports(String effectCode) {
        return effectCode != null && effectCode.startsWith(PREFIX);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        String taskType = effectCode.substring(PREFIX.length());
        TaskDeriveRule rule = rules.findByTaskType(taskType);
        if (rule == null) {
            throw new IllegalStateException("没有任务派生规则：" + taskType);
        }
        if (!Boolean.TRUE.equals(rule.enabled())) {
            log.info("任务派生规则「{}」已停用，跳过 {}#{}", taskType,
                    context.objectType(), context.objectId());
            return;
        }

        ObjectTaskSource source = loadSource(context.objectType(), context.objectId());
        if (source == null) {
            throw new IllegalStateException("派生任务时找不到对象 %s#%d"
                    .formatted(context.objectType(), context.objectId()));
        }

        LocalDate dueDate = resolveDueDate(rule, source);
        String title = rule.titleTemplate().replace("{对象名称}",
                source.objectName() == null ? "" : source.objectName());

        TaskInsert row = new TaskInsert();
        row.setTitle(title.length() > 100 ? title.substring(0, 100) : title);
        row.setTaskType(taskType);
        row.setObjectType(context.objectType());
        row.setObjectId(context.objectId());
        row.setOwnerNo(source.ownerNo());
        row.setOwnerName(source.ownerName());
        row.setDueDate(dueDate);
        row.setTaskState(TaskStateMachine.STATE_PENDING);
        row.setCreatedBy(OperatorContext.current().account().name());
        tasks.insert(row);

        // 补记「（空）→ 待处理」流转，与业务对象创建同一套路（E1-2）
        transitions.initialize(TaskStateMachine.OBJECT_TYPE, row.getId(),
                TaskStateMachine.FIELD_TASK_STATE, "CREATE");
        log.info("派生任务 {}「{}」← {}#{}，截止 {}", row.getId(), taskType,
                context.objectType(), context.objectId(), dueDate);
    }

    private LocalDate resolveDueDate(TaskDeriveRule rule, ObjectTaskSource source) {
        if (rule.takesDueFromObjectField()) {
            String field = rule.dueBase().substring(OBJECT_FIELD_PREFIX.length());
            if (!"expect_publish_date".equals(field)) {
                throw new IllegalStateException("未支持的 due_base 字段：" + rule.dueBase());
            }
            if (source.dueFromField() == null) {
                throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                        "派生「%s」任务需要对象上的预计发布/上架时间，当前为空".formatted(rule.taskType()));
            }
            // 13.1.2 第 2 条：截止 = 字段值本身，不是字段 + offset
            return source.dueFromField();
        }
        int offset = rule.dueOffsetDays() == null ? 0 : rule.dueOffsetDays();
        return LocalDate.now().plusDays(offset);
    }

    private ObjectTaskSource loadSource(String objectType, long objectId) {
        return switch (objectType) {
            case DemandStateMachines.OBJECT_TYPE -> tasks.loadDemand(objectId);
            case CourseStateMachines.OBJECT_TYPE -> tasks.loadCourse(objectId);
            case TrainingStateMachines.SESSION_OBJECT_TYPE -> tasks.loadTrainingSession(objectId);
            case CaseStateMachines.OBJECT_TYPE -> tasks.loadCase(objectId);
            default -> throw new IllegalStateException(
                    "DERIVE_TASK 不支持对象类型 " + objectType + "（" + Effect.deriveTask("") + "）");
        };
    }
}
