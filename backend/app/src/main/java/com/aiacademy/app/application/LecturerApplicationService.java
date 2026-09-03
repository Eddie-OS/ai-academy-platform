package com.aiacademy.app.application;

import com.aiacademy.app.repository.LecturerBoardMapper;
import com.aiacademy.app.repository.LecturerFieldLogMapper;
import com.aiacademy.app.repository.TrialLedgerMapper;
import com.aiacademy.app.web.dto.TrialLedgerQuery;
import com.aiacademy.business.lecturer.domain.CertificationForm;
import com.aiacademy.business.lecturer.domain.CertificationRecord;
import com.aiacademy.business.lecturer.domain.CultivationForm;
import com.aiacademy.business.lecturer.domain.CultivationRecord;
import com.aiacademy.business.lecturer.domain.Lecturer;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.lecturer.domain.LecturerForm;
import com.aiacademy.business.lecturer.domain.LecturerListItem;
import com.aiacademy.business.lecturer.domain.LecturerQuery;
import com.aiacademy.business.lecturer.domain.LevelLogForm;
import com.aiacademy.business.lecturer.domain.LevelLogRecord;
import com.aiacademy.business.lecturer.service.CertificationService;
import com.aiacademy.business.lecturer.service.CultivationService;
import com.aiacademy.business.lecturer.service.LecturerService;
import com.aiacademy.business.lecturer.service.LevelLogService;
import com.aiacademy.business.training.domain.TrainingEnums;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.audit.AuditLog;
import com.aiacademy.platform.audit.AuditSnapshotSource;
import com.aiacademy.platform.audit.domain.FieldChange;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.audit.service.OpLogWriter;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import com.aiacademy.platform.storage.service.AttachmentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
public class LecturerApplicationService implements AuditSnapshotSource {

    /** 与附件、审计共用的对象类型码。讲师没有状态机，这个码只出现在操作审计里。 */
    public static final String OBJECT_TYPE = "LECTURER";

    /**
     * 累计统计只数「上完了的」场次。
     *
     * <p>状态值从状态机模块取而不是写字面量（出口准则 E2-6）——转换表改了状态名，
     * 写死的那一份不会报错，只会静默地把所有讲师的累计次数变成 0。
     */
    private static final List<String> FINISHED_SESSION_STATES =
            List.of(TrainingStateMachines.SESSION_FINISHED, TrainingStateMachines.SESSION_ARCHIVED);

    private final LecturerService lecturers;
    private final CultivationService cultivations;
    private final CertificationService certifications;
    private final LevelLogService levelLogs;
    private final LecturerBoardMapper board;
    private final LecturerFieldLogMapper fieldLogs;
    private final TrialLedgerMapper trialLedger;
    private final AttachmentService attachments;
    private final OpLogWriter opLogs;

    public LecturerApplicationService(LecturerService lecturers, CultivationService cultivations,
                                      CertificationService certifications, LevelLogService levelLogs,
                                      LecturerBoardMapper board, LecturerFieldLogMapper fieldLogs,
                                      TrialLedgerMapper trialLedger, AttachmentService attachments,
                                      OpLogWriter opLogs) {
        this.lecturers = lecturers;
        this.cultivations = cultivations;
        this.certifications = certifications;
        this.levelLogs = levelLogs;
        this.board = board;
        this.fieldLogs = fieldLogs;
        this.trialLedger = trialLedger;
        this.attachments = attachments;
        this.opLogs = opLogs;
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
        long id = lecturers.createManually(form);
        linkAvatar(id, form.avatarAttachmentId());
        return id;
    }

    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.UPDATE)
    public void update(long id, LecturerForm form) {
        lecturers.update(id, form);
        linkAvatar(id, form.avatarAttachmentId());
    }

    /**
     * 档案字段快照。键是中文，直接落操作审计。不含系统字段。
     *
     * <p>认证状态不在档案上：有认证记录取最新一条，否则用试讲合格与培养状态推出。
     */
    @Override
    public Map<String, Object> auditSnapshot(long objectId) {
        Lecturer lecturer = lecturers.get(objectId);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("讲师姓名", lecturer.getLecturerName());
        snapshot.put("来源部门", lecturer.getSourceDept());
        snapshot.put("上岗状态", lecturer.getDutyState());
        snapshot.put("培养状态", lecturer.getTrainingState());
        snapshot.put("认证状态", currentCertState(objectId, lecturer));
        snapshot.put("在池状态", lecturer.getPoolState());
        snapshot.put("讲师等级", lecturer.getLecturerLevel());
        return snapshot;
    }

    @Transactional(readOnly = true)
    public List<LecturerFieldLogMapper.FieldLogRow> statusFieldLogs(long lecturerId) {
        lecturers.get(lecturerId);
        return fieldLogs.listStatusChanges(OBJECT_TYPE, lecturerId);
    }

    private void linkAvatar(long lecturerId, Long attachmentId) {
        if (attachmentId == null) {
            return;
        }
        attachments.link(attachmentId, AttachmentOwnerType.LECTURER, lecturerId, "avatar", 0);
    }

    /**
     * 逻辑删除（SEC2）。场次与试讲仍保留 {@code lecturer_id}，姓名按已删记录回查，
     * 日历和场次列表不会变成空讲师。
     *
     * <p>不再因「上过课／有试讲」拒绝。运营要清演示数据或录错的人时，移出讲师池不够——
     * 人还在池里。删除只是从池里拿掉，不级联删场次。
     */
    @Transactional
    public void softDelete(long id) {
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

    // -------------------------------------------------------------------------
    // 培养计划与培养记录（只记录结果，不是培养引擎）
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CultivationRecord> cultivationRecords(long lecturerId) {
        return cultivations.list(lecturerId);
    }

    @Transactional
    public long createCultivation(long lecturerId, CultivationForm form) {
        return cultivations.create(lecturerId, form);
    }

    @Transactional
    public void updateCultivation(long lecturerId, long recordId, CultivationForm form) {
        cultivations.update(lecturerId, recordId, form);
    }

    @Transactional
    public void removeCultivation(long lecturerId, long recordId) {
        cultivations.remove(lecturerId, recordId);
    }

    @Transactional(readOnly = true)
    public List<CertificationRecord> certificationRecords(long lecturerId) {
        return certifications.list(lecturerId);
    }

    @Transactional
    public long createCertification(long lecturerId, CertificationForm form) {
        String before = currentCertState(lecturerId, lecturers.get(lecturerId));
        long id = certifications.create(lecturerId, form);
        recordCertChange(lecturerId, before, form.certState(), form.opinion());
        return id;
    }

    @Transactional
    public void updateCertification(long lecturerId, long recordId, CertificationForm form) {
        String before = currentCertState(lecturerId, lecturers.get(lecturerId));
        certifications.update(lecturerId, recordId, form);
        recordCertChange(lecturerId, before, form.certState(), form.opinion());
    }

    @Transactional
    public void removeCertification(long lecturerId, long recordId) {
        String before = currentCertState(lecturerId, lecturers.get(lecturerId));
        certifications.remove(lecturerId, recordId);
        Lecturer lecturer = lecturers.get(lecturerId);
        recordCertChange(lecturerId, before, currentCertState(lecturerId, lecturer), null);
    }

    @Transactional(readOnly = true)
    public List<LevelLogRecord> listLevelLogs(long lecturerId) {
        return levelLogs.list(lecturerId);
    }

    @Transactional
    public long createLevelLog(long lecturerId, LevelLogForm form) {
        return levelLogs.create(lecturerId, form);
    }

    @Transactional
    public void updateLevelLog(long lecturerId, long recordId, LevelLogForm form) {
        levelLogs.update(lecturerId, recordId, form);
    }

    @Transactional
    public void removeLevelLog(long lecturerId, long recordId) {
        levelLogs.remove(lecturerId, recordId);
    }

    private String currentCertState(long lecturerId, Lecturer lecturer) {
        List<CertificationRecord> records = certifications.list(lecturerId);
        if (!records.isEmpty()) {
            return records.get(0).getCertState();
        }
        return LecturerEnums.certDisplayOf(
                Boolean.TRUE.equals(lecturer.getTrialQualified()), lecturer.getTrainingState());
    }

    private void recordCertChange(long lecturerId, String before, String after, String remark) {
        if (Objects.equals(before, after)) {
            return;
        }
        opLogs.recordFieldChanges(OBJECT_TYPE, lecturerId,
                List.of(new FieldChange("认证状态", before, after)), remark);
    }
}
