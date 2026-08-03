package com.aiacademy.app.application;

import com.aiacademy.app.repository.CourseRefMapper;
import com.aiacademy.app.repository.LecturerLookupMapper;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.training.repository.TrainingSessionMapper;
import com.aiacademy.business.training.service.TrainingSessionService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 排课三项校验（需求 11.4.1）。
 *
 * <p>这是 <b>C9 允许的三处业务前置校验之一</b>（另两处是需求归档前必须验收通过、案例上架前必须
 * 审核通过），也是全项目仅有的三处。规则 C2 禁止为状态变更添加业务前置条件，这一条是需求 11.4.1
 * 显式开的口子。<b>不要照着它给别的操作加前置校验。</b>
 *
 * <p>三项的性质<b>不同</b>，实现上必须区别对待：
 * <ol>
 *   <li>讲师培养状态＝可上岗（规则 TS4）——<b>硬阻断</b></li>
 *   <li>课程主状态 ∈ 发布及之后——<b>硬阻断</b></li>
 *   <li>同一讲师同一天时段冲突——<b>仅提示</b>，判断权交给运营（同一讲师一天讲两场是常见安排）</li>
 * </ol>
 * 把第三项也做成阻断，就等于让系统替线下做判断，违反原则一。
 *
 * <p>触发时机是四个（需求 11.4.1 落地要点第 2 条）：创建场次、改授课讲师、改关联课程、改培训
 * 日期或时间。因此校验不能只挂在创建那条转换的副作用上——编辑与日历拖动都要再跑一次。
 *
 * <p>校验放在 app 层：讲师与课程分属另外两个业务模块，培训模块按 AR-1 看不到它们（AR-4）。
 */
@Component
public class SchedulingValidator {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("M 月 d 日");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final CourseRefMapper courses;
    private final LecturerLookupMapper lecturers;
    private final TrainingSessionService sessions;

    public SchedulingValidator(CourseRefMapper courses, LecturerLookupMapper lecturers,
                               TrainingSessionService sessions) {
        this.courses = courses;
        this.lecturers = lecturers;
        this.sessions = sessions;
    }

    /**
     * 两项硬阻断校验。任一不满足直接抛 {@code BIZ_RULE_VIOLATED}，整笔事务回滚。
     *
     * @param courseId   关联课程
     * @param lecturerId 授课讲师
     */
    @Transactional(readOnly = true)
    public void requireSchedulable(Long courseId, Long lecturerId) {
        LecturerLookupMapper.LecturerRef lecturer = lecturerId == null ? null
                : lecturers.findRefById(lecturerId);
        if (lecturer == null) {
            throw new BizException(ErrorCode.PARAM_INVALID, "授课讲师不存在或已删除：" + lecturerId);
        }
        if (!LecturerEnums.TRAINING_QUALIFIED.equals(lecturer.trainingState())) {
            // 文案是需求 11.4.1 校验一规定的原话形态，其中的培养状态原样回显，运营才知道该去改什么
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "讲师 %s 当前状态为「%s」，未达%s状态，无法排课"
                            .formatted(lecturer.lecturerName(), lecturer.trainingState(),
                                    LecturerEnums.TRAINING_QUALIFIED));
        }

        CourseRefMapper.CourseRef course = courseId == null ? null : courses.findById(courseId);
        if (course == null) {
            throw new BizException(ErrorCode.PARAM_INVALID, "关联课程不存在或已删除：" + courseId);
        }
        if (!CourseStateMachines.MAIN_STATES_SCHEDULABLE.contains(course.mainState())) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "课程 %s 当前状态为「%s」，尚未发布，无法排课"
                            .formatted(course.courseName(), course.mainState()));
        }
    }

    /**
     * 两项非阻断提示：讲师时段冲突（校验三）与课程已过期（规则 EX6）。
     *
     * <p>返回值给前端做二次确认弹窗与保存后的提示条。<b>它们不影响保存结果</b>——运营点了继续
     * 就该存下去，因为一天两场、用过期课程再讲一次，线下都是真实存在的安排。
     *
     * @param excludeSessionId 编辑时排除自己；新建时传 0
     */
    @Transactional(readOnly = true)
    public List<String> warnings(Long courseId, long lecturerId, LocalDate trainingDate,
                                 java.time.LocalTime startTime, java.time.LocalTime endTime,
                                 long excludeSessionId) {
        List<String> warnings = new ArrayList<>();

        LecturerLookupMapper.LecturerRef lecturer = lecturers.findRefById(lecturerId);
        String lecturerName = lecturer == null ? String.valueOf(lecturerId) : lecturer.lecturerName();
        for (TrainingSessionMapper.ConflictSession conflict : sessions.conflicts(
                lecturerId, trainingDate, startTime, endTime, excludeSessionId)) {
            warnings.add("讲师 %s 在 %s %s–%s 已有另一场培训（场次 %s），确认继续？".formatted(
                    lecturerName, conflict.trainingDate().format(DATE),
                    conflict.startTime().format(TIME), conflict.endTime().format(TIME),
                    conflict.sessionNo()));
        }

        CourseRefMapper.CourseRef course = courseId == null ? null : courses.findById(courseId);
        if (course != null && course.validityEndDate() != null
                && course.validityEndDate().isBefore(trainingDate)) {
            // 规则 EX6：过期课程仍可排课，只提示。过期标记是实时算的，不落库（需求 9.3.1 第 12c 项）
            warnings.add("课程 %s 的有效期已于 %s 截止，仍可排课，请确认是否需要先更新课程材料"
                    .formatted(course.courseName(), course.validityEndDate()));
        }
        return warnings;
    }
}
