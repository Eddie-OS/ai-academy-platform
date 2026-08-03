package com.aiacademy.platform.statemachine.domain.machines;

import static com.aiacademy.platform.statemachine.domain.Transition.of;

import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.SimpleStateMachineDef;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import java.util.List;
import java.util.Set;

/**
 * 课程评审记录与试讲记录两个状态机，来源需求文档 5.5、5.6。
 *
 * <p>两者都是「一门课程多条记录、每条一轮、轮次不设上限、历史不被覆盖」的形态（议题 7）。
 * 它们是独立的业务对象，因此有自己的对象类型与状态字段，不是课程的子状态。
 */
public final class CourseRecordStateMachines {

    public static final String REVIEW_OBJECT_TYPE = "COURSE_REVIEW";
    public static final String TRIAL_OBJECT_TYPE = "COURSE_TRIAL";

    /** 两个状态字段名。业务侧按字段名调状态机，只引用这里的常量（同 {@link CourseStateMachines}）。 */
    public static final String FIELD_REVIEW_STATE = "评审记录状态";
    public static final String FIELD_TRIAL_STATE = "试讲记录状态";

    /** 课程提交评审时创建评审记录（空 → 待录入结论）。 */
    public static final String ACTION_CREATE_BY_COURSE_SUBMIT = "CREATE_BY_COURSE_SUBMIT";

    /** 创建试讲记录（空 → 待录入结论）。 */
    public static final String ACTION_CREATE_TRIAL = "CREATE";

    /** 录入结论，两个状态机共用同一个动作码。 */
    public static final String ACTION_RECORD_RESULT = "RECORD_RESULT";

    private CourseRecordStateMachines() {
    }

    /**
     * 需求 5.5 课程评审记录状态。
     *
     * <p>一期<b>不定义专家人数、不做结论汇总规则、不支持「有条件通过」</b>（议题 10）。
     * 结论与专业意见由运营依据线下会议纪要人工录入，一条记录一个结论。
     */
    public static StateMachineDef review() {
        return new SimpleStateMachineDef("课程评审记录状态", REVIEW_OBJECT_TYPE, FIELD_REVIEW_STATE,
                Set.of("已完成"), List.of(
                of(null, ACTION_CREATE_BY_COURSE_SUBMIT, "课程提交评审", "待录入结论",
                        Effect.SET_ROUND_NO, Effect.BIND_MATERIAL_VERSION),
                of("待录入结论", ACTION_RECORD_RESULT, "录入评审结果与专业意见", "已完成",
                        Effect.DRIVE_COURSE_MAIN_STATE)));
    }

    /**
     * 需求 5.6 试讲记录状态。
     *
     * <p>每轮产出<b>两个独立结论</b>（课程试讲结论 + 讲师试讲结论，议题 17），分开记录、互不影响。
     * 结论不一致时系统<b>只做标记与提示，不做任何自动处置</b>：合格/不合格与不合格/合格两种组合
     * 都置「结论不一致」标记，由线下评审会决定后由运营维护状态。
     */
    public static StateMachineDef trial() {
        return new SimpleStateMachineDef("试讲记录状态", TRIAL_OBJECT_TYPE, FIELD_TRIAL_STATE,
                Set.of("已完成"), List.of(
                of(null, ACTION_CREATE_TRIAL, "创建试讲记录", "待录入结论",
                        Effect.SET_ROUND_NO),
                of("待录入结论", ACTION_RECORD_RESULT, "录入意见、问题清单与双结论", "已完成",
                        Effect.DRIVE_COURSE_MAIN_STATE, Effect.UPDATE_LECTURER_TRIAL_FLAG)));
    }

    public static List<StateMachineDef> all() {
        return List.of(review(), trial());
    }
}
