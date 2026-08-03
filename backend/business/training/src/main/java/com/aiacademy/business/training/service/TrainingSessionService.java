package com.aiacademy.business.training.service;

import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.business.training.domain.TrainingSession;
import com.aiacademy.business.training.domain.TrainingSessionForm;
import com.aiacademy.business.training.domain.TrainingSessionListItem;
import com.aiacademy.business.training.domain.TrainingSessionQuery;
import com.aiacademy.business.training.repository.TrainingSessionMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * 培训场次主表的读写（需求 11.4、11.9）。
 *
 * <p><b>排课三项校验不在这里</b>：讲师培养状态与课程主状态分属另外两个业务模块（AR-1），
 * 校验按 AR-4 归 app 层的 {@code SchedulingValidator}。本类只做本表能自证的事：字段合法性、
 * 场次号、时长推算。
 */
@Service
public class TrainingSessionService {

    private final TrainingSessionMapper mapper;
    private final StateMachineRegistry stateMachines;

    public TrainingSessionService(TrainingSessionMapper mapper, StateMachineRegistry stateMachines) {
        this.mapper = mapper;
        this.stateMachines = stateMachines;
    }

    /**
     * 在指定计划下新建一个场次，返回主键。
     *
     * <p>调用方<b>必须</b>紧接着推进「（空）→ 待开课」，那一跳会执行排课三项校验的两项硬阻断
     * （{@code VALIDATE_SCHEDULING}），并补记流转日志。
     */
    @Transactional
    public long create(long planId, TrainingSessionForm form) {
        validate(form);

        TrainingSessionMapper.PlanRef plan = mapper.lockPlanForSessionNo(planId);
        if (plan == null) {
            throw new NotFoundException("培训计划不存在或已删除：" + planId);
        }
        int seq = mapper.maxSessionSeq(planId) + 1;

        TrainingSession session = new TrainingSession();
        applyForm(session, form);
        session.setPlanId(planId);
        session.setSessionNo("%s-%02d".formatted(plan.planNo(), seq));
        if (session.getSessionName() == null) {
            // 需求 11.4 第 3 项：留空时自动生成。用序号而不是当前场次数，
            // 删掉一场之后新建的下一场才不会与既有的某一场同名
            session.setSessionName("%s 第%d场".formatted(plan.planName(), seq));
        }
        session.setSessionState(initialSessionState());
        return mapper.insert(session, operator());
    }

    @Transactional
    public void update(long id, TrainingSessionForm form) {
        validate(form);
        requireExisting(id);

        TrainingSession session = new TrainingSession();
        applyForm(session, form);
        session.setId(id);
        mapper.update(session, operator());
    }

    /** 日历页拖动改期（需求 11.8）。校验由调用方在改期前后各跑一次，理由见 app 层的应用服务。 */
    @Transactional
    public void reschedule(long id, LocalDate trainingDate) {
        if (mapper.updateTrainingDate(id, trainingDate, operator()) == 0) {
            throw new NotFoundException("培训场次不存在或已删除：" + id);
        }
    }

    @Transactional
    public void softDelete(long id) {
        if (mapper.softDelete(id, operator()) == 0) {
            throw new NotFoundException("培训场次不存在或已删除：" + id);
        }
    }

    @Transactional(readOnly = true)
    public TrainingSessionListItem get(long id) {
        TrainingSessionListItem item =
                mapper.selectDetailById(id, TrainingEnums.ATTEND_PRESENT);
        if (item == null) {
            throw new NotFoundException("培训场次不存在或已删除：" + id);
        }
        return item;
    }

    @Transactional(readOnly = true)
    public PageResult<TrainingSessionListItem> page(TrainingSessionQuery query) {
        long total = mapper.countPage(query);
        if (total == 0) {
            return PageResult.of(List.of(), 0, query);
        }
        return PageResult.of(mapper.selectPage(query, TrainingEnums.ATTEND_PRESENT,
                query.offset(), query.sortColumn(), query.sortDirection()), total, query);
    }

    @Transactional(readOnly = true)
    public TrainingSession require(long id) {
        return requireExisting(id);
    }

    /**
     * 同一讲师同一天的时段冲突（排课校验三）。<b>只用于提示</b>，判断权交给运营——同一讲师
     * 一天讲两场是常见安排。
     */
    @Transactional(readOnly = true)
    public List<TrainingSessionMapper.ConflictSession> conflicts(
            long lecturerId, LocalDate trainingDate, LocalTime startTime, LocalTime endTime,
            long excludeSessionId) {
        return mapper.findLecturerConflicts(
                lecturerId, trainingDate, startTime, endTime, excludeSessionId);
    }

    private String initialSessionState() {
        return stateMachines.require(TrainingStateMachines.SESSION_OBJECT_TYPE,
                TrainingStateMachines.FIELD_SESSION_STATE, null,
                TrainingStateMachines.ACTION_CREATE_SESSION).to();
    }

    private TrainingSession requireExisting(long id) {
        TrainingSession session = mapper.selectById(id);
        if (session == null) {
            throw new NotFoundException("培训场次不存在或已删除：" + id);
        }
        return session;
    }

    private void applyForm(TrainingSession session, TrainingSessionForm form) {
        session.setSessionName(blankToNull(form.sessionName()));
        session.setCourseId(form.courseId());
        session.setLecturerId(form.lecturerId());
        session.setTrainingDate(form.trainingDate());
        session.setStartTime(form.startTime());
        session.setEndTime(form.endTime());
        session.setDurationHours(form.durationHours() == null
                ? derivedHours(form) : form.durationHours());
        session.setTrainingForm(form.trainingForm());
        session.setVenue(blankToNull(form.venue()));
        session.setOnlineLink(blankToNull(form.onlineLink()));
        session.setStudentScope(form.studentScope().trim());
        session.setPlanAttendeeCount(form.planAttendeeCount());
        session.setRemark(blankToNull(form.remark()));
    }

    /** 时长＝结束时间 − 开始时间，保留 1 位小数（需求 11.4 第 8 项支持 0.5 步进）。 */
    private static BigDecimal derivedHours(TrainingSessionForm form) {
        long minutes = Duration.between(form.startTime(), form.endTime()).toMinutes();
        return BigDecimal.valueOf(minutes)
                .divide(BigDecimal.valueOf(60), 1, RoundingMode.HALF_UP);
    }

    /**
     * 表单校验。
     *
     * <p>这里只有<b>字段取值合法性</b>：三项排课校验属于 C9 的例外，在 app 层执行；除此之外
     * 不得再添加任何业务前置条件（规则 C2）——比如「计划已完成就不能加场次」，加了就会拦住
     * 运营补录历史培训。
     */
    private void validate(TrainingSessionForm form) {
        if (!TrainingEnums.FORMS.contains(form.trainingForm())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "培训形式只能是：" + String.join(" / ", TrainingEnums.FORMS));
        }
        if (!form.endTime().isAfter(form.startTime())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "结束时间必须晚于开始时间");
        }
        if (TrainingEnums.needsVenue(form.trainingForm()) && isBlank(form.venue())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "培训形式为「%s」时必须填写培训地点".formatted(form.trainingForm()));
        }
        if (TrainingEnums.needsOnlineLink(form.trainingForm()) && isBlank(form.onlineLink())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "培训形式为「%s」时必须填写线上链接".formatted(form.trainingForm()));
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String blankToNull(String value) {
        return isBlank(value) ? null : value;
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
