package com.aiacademy.app.application;

import com.aiacademy.app.repository.DemandCourseLinkMapper;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.platform.audit.domain.FieldChange;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.audit.service.OpLogWriter;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * 需求↔课程 N:N 关联的双向维护（需求 8.4，规则 R1～R4）。
 *
 * <p>两个入口——需求详情页「关联课程」页签与课程详情页「关联需求」页签——<b>操作的是同一张表</b>，
 * 因此实现只有这一份，两侧的 Controller 都调它。做成两份的后果不是重复代码，而是两侧的校验
 * 与留痕慢慢长歪：一侧记了审计日志、另一侧没记，事后没人能解释关联是什么时候没的。
 *
 * <p><b>关联不校验状态。</b>需求还没评审、课程还没发布都可以关联：规则 C2 不允许为业务动作加
 * 前置校验，而运营录入的大多是已经发生的历史。需求 A8a-4 的「下拉只列已发布课程」是<b>培训排课</b>
 * 的候选项规则（11.4），不是这里的。
 */
@Service
public class DemandCourseLinkService {

    private final DemandCourseLinkMapper links;
    private final DemandService demands;
    private final CourseService courses;
    private final OpLogWriter opLogs;

    public DemandCourseLinkService(DemandCourseLinkMapper links, DemandService demands,
                                   CourseService courses, OpLogWriter opLogs) {
        this.links = links;
        this.demands = demands;
        this.courses = courses;
        this.opLogs = opLogs;
    }

    /**
     * 建立关联（重复关联静默成功，规则 K2）。
     *
     * <p>已关联时不再写一条「新增」审计——那不是一次新的关联。但如果这次带了不同的关联说明，
     * 说明运营是来改说明的，按修改记一行字段变更（需求 5.12 要求修改类操作记字段名与前后值）。
     */
    @Transactional
    public void link(long demandId, long courseId, String linkNote) {
        demands.require(demandId);
        courses.require(courseId);
        String note = blankToNull(linkNote);

        String existingNote = links.noteOf(demandId, courseId);
        if (links.insertIfAbsent(demandId, courseId, note, operator()) != null) {
            recordOnBothSides(demandId, courseId, OpType.CREATE,
                    "关联课程 #" + courseId, "关联需求 #" + demandId);
            return;
        }
        if (Objects.equals(existingNote, note)) {
            return;
        }
        links.updateNote(demandId, courseId, note);
        List<FieldChange> changes = List.of(new FieldChange("关联说明", existingNote, note));
        opLogs.recordFieldChanges(DemandStateMachines.OBJECT_TYPE, demandId, changes,
                "课程 #" + courseId + " 的关联说明");
        opLogs.recordFieldChanges(CourseStateMachines.OBJECT_TYPE, courseId, changes,
                "需求 #" + demandId + " 的关联说明");
    }

    /**
     * 解除关联。<b>物理删除</b>——这张表没有 {@code deleted} 列，变更靠审计日志留痕（开发 6.3.1）。
     *
     * <p>关联本来就不存在时什么也不做：两名运营同时点「解除」，第二个人不该看到一个错误。
     */
    @Transactional
    public void unlink(long demandId, long courseId) {
        if (links.delete(demandId, courseId) == 0) {
            return;
        }
        recordOnBothSides(demandId, courseId, OpType.DELETE,
                "解除关联课程 #" + courseId, "解除关联需求 #" + demandId);
    }

    @Transactional(readOnly = true)
    public List<DemandCourseLinkMapper.LinkedCourse> coursesOf(long demandId) {
        demands.require(demandId);
        return links.coursesOf(demandId);
    }

    @Transactional(readOnly = true)
    public List<DemandCourseLinkMapper.LinkedDemand> demandsOf(long courseId) {
        courses.require(courseId);
        return links.demandsOf(courseId);
    }

    /**
     * 两侧各记一行审计。
     *
     * <p>关联表自己没有历史（解除即物理删除），而两个详情页各有各的操作日志：只记需求那一侧的话，
     * 从课程详情页解除的关联在课程的日志里查不到，追溯时看到的是「课程凭空少了一条关联需求」。
     */
    private void recordOnBothSides(long demandId, long courseId, OpType op,
                                   String demandRemark, String courseRemark) {
        opLogs.record(DemandStateMachines.OBJECT_TYPE, demandId, op, demandRemark);
        opLogs.record(CourseStateMachines.OBJECT_TYPE, courseId, op, courseRemark);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
