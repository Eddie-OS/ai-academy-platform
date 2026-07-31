package com.aiacademy.platform.statemachine.domain.machines;

import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import java.util.List;
import java.util.stream.Stream;

/**
 * 全部转换表的汇总入口：<b>16 张表</b>（需求 5.13 的 15 个业务状态机 + 任务状态机）。
 *
 * <p>需求 5.13 要求「开发按本清单核对，不多不少」。这里是唯一的装载点，
 * 新增或删除状态机只改这一处。
 */
public final class StateMachineCatalog {

    /** 需求 5.13 的业务状态机个数。任务状态机不计入。 */
    public static final int BUSINESS_MACHINE_COUNT = 15;

    private StateMachineCatalog() {
    }

    /** 需求 5.13 清单的 15 个业务状态机。 */
    public static List<StateMachineDef> businessMachines() {
        return Stream.of(
                        DemandStateMachines.all(),
                        CourseStateMachines.all(),
                        CourseRecordStateMachines.all(),
                        TrainingStateMachines.all(),
                        CaseStateMachines.all())
                .flatMap(List::stream)
                .toList();
    }

    /** 引擎实际装载的 16 张转换表。 */
    public static List<StateMachineDef> all() {
        return Stream.concat(businessMachines().stream(), TaskStateMachine.all().stream()).toList();
    }
}
