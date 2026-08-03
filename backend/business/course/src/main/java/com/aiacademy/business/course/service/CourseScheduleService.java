package com.aiacademy.business.course.service;

import com.aiacademy.business.course.domain.CourseCalendarItem;
import com.aiacademy.business.course.domain.CourseSchedule;
import com.aiacademy.business.course.repository.CourseMapper;
import com.aiacademy.business.course.repository.CourseScheduleMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * 课程排期（需求 9.9，页面 P2-4）。
 *
 * <p><b>这里没有任何冲突校验。</b>需求 9.9 写明排课三项校验只作用于培训场次创建（11.4），
 * 课程排期本身不做校验——课程开发节点没有资源争用，两门课程同一天提交评审是完全正常的。
 *
 * <p>需求 9.9 的「运营可拖动调整预计发布时间」改的是课程主表上的字段，走课程编辑接口，
 * 不在这里：那个字段参与列表筛选与红灯判定，让排期模块单独去改它会绕过乐观锁。
 */
@Service
public class CourseScheduleService {

    private final CourseScheduleMapper schedules;
    private final CourseMapper courses;
    private final StateMachineRegistry stateMachines;

    public CourseScheduleService(CourseScheduleMapper schedules, CourseMapper courses,
                                 StateMachineRegistry stateMachines) {
        this.schedules = schedules;
        this.courses = courses;
        this.stateMachines = stateMachines;
    }

    @Transactional(readOnly = true)
    public List<CourseSchedule> listByCourse(long courseId) {
        requireCourse(courseId);
        return schedules.findByCourse(courseId);
    }

    /**
     * 日历数据（月视图 / 周视图共用，需求 9.9）。
     *
     * @param from 区间起（含）
     * @param to   区间止（含）
     */
    @Transactional(readOnly = true)
    public List<CourseCalendarItem> calendar(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new BizException(ErrorCode.PARAM_INVALID, "请选择日历的起止日期");
        }
        if (to.isBefore(from)) {
            throw new BizException(ErrorCode.PARAM_INVALID, "日历的结束日期不能早于开始日期");
        }
        return schedules.calendar(from, to, terminalMainStates());
    }

    @Transactional
    public long create(long courseId, CourseSchedule.Form form) {
        requireCourse(courseId);
        return schedules.insert(courseId, form.nodeName(), form.planDate(), form.remark(), operator());
    }

    @Transactional
    public void update(long scheduleId, CourseSchedule.Form form) {
        if (schedules.update(scheduleId, form.nodeName(), form.planDate(), form.remark(), operator()) == 0) {
            throw new NotFoundException("排期节点不存在或已删除：" + scheduleId);
        }
    }

    @Transactional
    public void delete(long scheduleId) {
        if (schedules.softDelete(scheduleId, operator()) == 0) {
            throw new NotFoundException("排期节点不存在或已删除：" + scheduleId);
        }
    }

    /** 终态从转换表取，不在代码里抄一份状态值——抄的那份不会随需求 5.3.1 一起改。 */
    private Set<String> terminalMainStates() {
        return stateMachines.requireMachine(CourseStateMachines.OBJECT_TYPE,
                CourseStateMachines.FIELD_MAIN_STATE).terminalStates();
    }

    private void requireCourse(long courseId) {
        if (courses.selectById(courseId) == null) {
            throw new NotFoundException("课程不存在或已删除：" + courseId);
        }
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
