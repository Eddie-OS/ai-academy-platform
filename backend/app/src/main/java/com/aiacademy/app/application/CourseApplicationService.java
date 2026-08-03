package com.aiacademy.app.application;

import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.business.lecturer.service.LecturerService;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 课程里需要「业务写入 + 状态转换」一起完成的两个动作（AR-4：跨模块编排放 app 层）。
 *
 * <p>纯读取不经过这里，Controller 直接调 {@code CourseService}。放进来的是三件事：
 * 立项时要补记初始状态流转，关闭时要同时写关闭原因，写入负责人后要让他自动入讲师池——
 * 它们各自跨了两个模块，任何一侧单独成功都是坏数据。
 */
@Service
public class CourseApplicationService {

    private final CourseService courses;
    private final LecturerService lecturers;
    private final TransitionApplicationService transitions;

    public CourseApplicationService(CourseService courses,
                                    LecturerService lecturers,
                                    TransitionApplicationService transitions) {
        this.courses = courses;
        this.lecturers = lecturers;
        this.transitions = transitions;
    }

    /**
     * 立项一门课程：INSERT 之后补记「（空）→ 立项」的流转日志，并派发它的副作用
     * （需求 13.1.2 要求派生一条「课程开发」任务，阶段 3 落地）。
     *
     * <p>两步同事务。补记失败则课程一并回滚——一门没有立项时间戳的课程，会让需求 15.2 的
     * 课程开发周期少一条数据，而这在事后无法补齐（出口准则 E1-2）。
     */
    @Transactional
    public long initiate(CourseForm form) {
        long id = courses.create(form);
        transitions.initialize(CourseStateMachines.OBJECT_TYPE, id,
                CourseStateMachines.FIELD_MAIN_STATE, CourseStateMachines.ACTION_INITIATE);
        lecturers.ensureCourseOwnerInPool(form.ownerNo());
        return id;
    }

    /**
     * 编辑课程基本信息，并让（可能换过的）负责人自动入讲师池（需求 10.4 第 1 行）。
     *
     * <p>编辑走 app 层只是因为这条入池规则：{@code course} 与 {@code lecturer} 是两个业务模块，
     * 互相不能 import（AR-1）。入池本身对已在池的工号是空操作，所以每次编辑都调是安全的。
     */
    @Transactional
    public void update(long id, CourseForm form, Integer version) {
        courses.update(id, form, version);
        lecturers.ensureCourseOwnerInPool(form.ownerNo());
    }

    /**
     * 关闭课程开发（需求 5.3.1 表格第 15 行：立项 / 开发 / 自检 / 优化 四个状态都可以关闭）。
     *
     * <p>先转换后写原因：转换非法时（比如课程已经发布）整个请求以 {@code ILLEGAL_TRANSITION}
     * 结束，关闭原因不会留在一门仍在正常推进的课程上。
     *
     * <p>关闭原因不走通用编辑接口，因为需求 9.3.2 第 20 项要求它在主状态为「已关闭」时必填——
     * 放进那个表单就没法表达这个必填，也没法保证「有原因 ⇔ 已关闭」。
     */
    @Transactional
    public void close(long id, String closeReason, Integer version) {
        transitions.transit(new TransitCommand(CourseStateMachines.OBJECT_TYPE, id,
                CourseStateMachines.FIELD_MAIN_STATE, CourseStateMachines.ACTION_CLOSE_DEVELOPMENT,
                version, closeReason));
        courses.writeCloseReason(id, closeReason);
    }
}
