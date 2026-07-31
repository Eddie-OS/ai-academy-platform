package com.aiacademy.platform.statemachine.domain;

import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 16 个状态机的状态值分别存在哪张表的哪一列上。<b>8 类对象、16 列，与需求 5.11 的「对象类型」
 * 枚举一一对应</b>。
 *
 * <p><b>为什么要有这张映射表：</b>状态流转日志是全对象共用一张表（需求 5.11），状态写入与写日志
 * 必须在同一个事务里成对发生（E1-2）。如果让每个业务模块各自写自己的状态列，「写状态时必须写日志」
 * 就变成一条靠人记住的纪律，而它有 16 处可以被漏掉。有了这张映射表，
 * {@link com.aiacademy.platform.statemachine.service.StateTransitionService} 成为全库状态列的
 * <b>唯一</b>写入者，纪律变成了结构。
 *
 * <p>列名逐个对着 V1_001～V1_007 的建表脚本录入，由 {@code StateObjectMappingTest} 拿真实 schema
 * 逐条校验：列必须存在、必须是 VARCHAR、有无 version 必须与规则 K1 一致。
 */
public final class StateObjectMappings {

    private static final Map<String, StateObjectMapping> BY_OBJECT_TYPE = index(List.of(

            // 需求 5.2：一个分流出口字段 + 两组状态字段，出口一走 solution_state、出口二走 dev_state
            StateObjectMapping.lockedTable(DemandStateMachines.OBJECT_TYPE, "biz_demand")
                    .state("需求评审状态", "review_state")
                    .state("解决方案状态", "solution_state")
                    .state("需求开发状态", "dev_state")
                    .state("业务验收状态", "acceptance_state")
                    .state("需求交付标记", "delivery_mark")
                    .build(),

            // 需求 5.3～5.4：课程主状态 + 四个子状态，子状态随主状态自动置位
            StateObjectMapping.lockedTable(CourseStateMachines.OBJECT_TYPE, "biz_course")
                    .state("课程主状态", "main_state")
                    .state("课程开发状态", "dev_state")
                    .state("课程自检状态", "selfcheck_state")
                    .state("试讲状态", "trial_state")
                    .state("课程发布状态", "publish_state")
                    .build(),

            // 需求 5.5／5.6：评审与试讲各自是独立的记录对象，一门课程可以有多轮
            StateObjectMapping.table(CourseRecordStateMachines.REVIEW_OBJECT_TYPE, "dtl_course_review")
                    .state("评审记录状态", "record_state")
                    .build(),
            StateObjectMapping.table(CourseRecordStateMachines.TRIAL_OBJECT_TYPE, "dtl_course_trial")
                    .state("试讲记录状态", "record_state")
                    .build(),

            // 需求 5.7／5.8
            StateObjectMapping.table(TrainingStateMachines.PLAN_OBJECT_TYPE, "biz_training_plan")
                    .state("培训计划状态", "plan_state")
                    .build(),
            StateObjectMapping.table(TrainingStateMachines.SESSION_OBJECT_TYPE, "biz_training_session")
                    .state("培训场次状态", "session_state")
                    .build(),

            // 需求 5.9
            StateObjectMapping.lockedTable(CaseStateMachines.OBJECT_TYPE, "biz_case")
                    .state("案例状态", "case_state")
                    .build(),

            // 需求 5.10。任务不计入 5.13 的 15 个，但引擎照样装载它（开发 5.1.3）
            StateObjectMapping.table(TaskStateMachine.OBJECT_TYPE, "sys_task")
                    .state("任务状态", "task_state")
                    .build()));

    private StateObjectMappings() {
    }

    public static StateObjectMapping require(String objectType) {
        StateObjectMapping mapping = BY_OBJECT_TYPE.get(objectType);
        if (mapping == null) {
            throw new IllegalStateException("对象类型 %s 没有登记状态列映射，已登记的是 %s"
                    .formatted(objectType, BY_OBJECT_TYPE.keySet()));
        }
        return mapping;
    }

    public static List<StateObjectMapping> all() {
        return List.copyOf(BY_OBJECT_TYPE.values());
    }

    private static Map<String, StateObjectMapping> index(List<StateObjectMapping> mappings) {
        Map<String, StateObjectMapping> index = new LinkedHashMap<>();
        for (StateObjectMapping mapping : mappings) {
            index.put(mapping.objectType(), mapping);
        }
        // 用 unmodifiableMap 而不是 Map.copyOf：后者不保留插入顺序，会让 all() 的遍历顺序
        // 和校验测试的失败信息每次运行都不一样。
        return java.util.Collections.unmodifiableMap(index);
    }
}
