package com.aiacademy.app.application;

import com.aiacademy.app.repository.LecturerBoardMapper;
import com.aiacademy.app.repository.TrialLedgerMapper;
import com.aiacademy.app.web.dto.TrialLedgerQuery;
import com.aiacademy.business.lecturer.domain.LecturerForm;
import com.aiacademy.business.lecturer.domain.LecturerListItem;
import com.aiacademy.business.lecturer.domain.LecturerQuery;
import com.aiacademy.business.lecturer.service.LecturerService;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 讲师驾驶舱的编排（AR-4）。
 *
 * <p>放在 app 层的原因有两条，都与 AR-1 有关：
 * <ul>
 *   <li>需求 10.3 的累计授课次数、累计学员人次、平均评分要读培训模块的三张表；
 *   <li>删除讲师前要看它有没有被培训场次或试讲记录引用，那两张表分属培训与课程模块。
 * </ul>
 *
 * <p><b>这里没有任何状态机调用。</b>讲师的两个枚举字段都不是状态机（规则 TS1、C10）。
 */
@Service
public class LecturerApplicationService {

    /**
     * 累计统计只数「上完了的」场次。
     *
     * <p>状态值从状态机模块取而不是写字面量（出口准则 E2-6）——转换表改了状态名，
     * 写死的那一份不会报错，只会静默地把所有讲师的累计次数变成 0。
     */
    private static final List<String> FINISHED_SESSION_STATES =
            List.of(TrainingStateMachines.SESSION_FINISHED, TrainingStateMachines.SESSION_ARCHIVED);

    private final LecturerService lecturers;
    private final LecturerBoardMapper board;
    private final TrialLedgerMapper trialLedger;

    public LecturerApplicationService(LecturerService lecturers, LecturerBoardMapper board,
                                      TrialLedgerMapper trialLedger) {
        this.lecturers = lecturers;
        this.board = board;
        this.trialLedger = trialLedger;
    }

    // -------------------------------------------------------------------------
    // 讲师池（需求 10.3、10.4、10.7）
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResult<LecturerListItem> page(LecturerQuery query) {
        long total = board.countPage(query, FINISHED_SESSION_STATES, TrainingEnums.ATTEND_PRESENT);
        if (total == 0) {
            return PageResult.of(List.of(), 0, query);
        }
        return PageResult.of(board.selectPage(query, query.offset(),
                query.sortColumn(), query.sortDirection(),
                FINISHED_SESSION_STATES, TrainingEnums.ATTEND_PRESENT), total, query);
    }

    @Transactional(readOnly = true)
    public LecturerListItem detail(long id) {
        LecturerListItem item = board.selectDetailById(
                id, FINISHED_SESSION_STATES, TrainingEnums.ATTEND_PRESENT);
        if (item == null) {
            throw new NotFoundException("讲师不存在或已删除：" + id);
        }
        return item;
    }

    @Transactional
    public long createManually(LecturerForm form) {
        return lecturers.createManually(form);
    }

    @Transactional
    public void update(long id, LecturerForm form) {
        lecturers.update(id, form);
    }

    /**
     * 逻辑删除（SEC2）。被引用时拒绝。
     *
     * <p><b>「删除」不是「移出讲师池」。</b>讲师上过课就不该被删掉——培训场次与试讲记录都拿
     * {@code lecturer_id} 做外键，删掉之后那些页面上会出现一个查不到的讲师ID。运营真正想做的
     * 通常是把在池状态改成「已移出」并填移出原因，那条路径保留全部历史（需求 10.3 第 14 项）。
     */
    @Transactional
    public void softDelete(long id) {
        int sessions = board.countSessions(id);
        int trials = board.countTrials(id);
        if (sessions > 0 || trials > 0) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    ("该讲师已关联 %d 个培训场次、%d 条试讲记录，不能删除。"
                            + "如果只是不再安排授课，请把在池状态改为「已移出」并填写移出原因")
                            .formatted(sessions, trials));
        }
        lecturers.softDelete(id);
    }

    /**
     * 试讲讲师结论 = 合格时置试讲合格标记（需求 10.3 第 9、10 项）。
     * 由副作用处理器 {@code LecturerTrialFlagEffectHandler} 调用。
     */
    @Transactional
    public void markTrialQualified(long lecturerId, LocalDate qualifiedDate) {
        lecturers.markTrialQualified(lecturerId, qualifiedDate);
    }

    // -------------------------------------------------------------------------
    // 详情页的两个页签（需求 10.5、10.6）
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<LecturerBoardMapper.TeachingRecordRow> teachingRecords(long lecturerId) {
        return board.teachingRecords(lecturerId, FINISHED_SESSION_STATES, TrainingEnums.ATTEND_PRESENT);
    }

    @Transactional(readOnly = true)
    public List<LecturerBoardMapper.EvaluationRow> evaluations(long lecturerId) {
        return board.evaluations(lecturerId);
    }

    @Transactional(readOnly = true)
    public List<String> sourceDepts() {
        return board.sourceDepts();
    }

    // -------------------------------------------------------------------------
    // 试讲台账（需求 10.2 页面 P3-3）
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResult<TrialLedgerMapper.TrialLedgerRow> trialLedger(TrialLedgerQuery query) {
        long total = trialLedger.countPage(query);
        if (total == 0) {
            return PageResult.of(List.of(), 0, query);
        }
        return PageResult.of(trialLedger.selectPage(query, query.offset(),
                query.sortColumn(), query.sortDirection()), total, query);
    }
}
