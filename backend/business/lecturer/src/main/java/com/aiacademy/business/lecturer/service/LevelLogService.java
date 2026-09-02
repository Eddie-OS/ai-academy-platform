package com.aiacademy.business.lecturer.service;

import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.lecturer.domain.LevelLogForm;
import com.aiacademy.business.lecturer.domain.LevelLogRecord;
import com.aiacademy.business.lecturer.repository.LecturerMapper;
import com.aiacademy.business.lecturer.repository.LevelLogMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 等级变更记录。只落库，不改档案等级、不写流转日志。 */
@Service
public class LevelLogService {

    private final LevelLogMapper mapper;
    private final LecturerMapper lecturers;

    public LevelLogService(LevelLogMapper mapper, LecturerMapper lecturers) {
        this.mapper = mapper;
        this.lecturers = lecturers;
    }

    @Transactional(readOnly = true)
    public List<LevelLogRecord> list(long lecturerId) {
        requireLecturer(lecturerId);
        return mapper.listByLecturer(lecturerId);
    }

    @Transactional
    public long create(long lecturerId, LevelLogForm form) {
        requireLecturer(lecturerId);
        mapper.lockChangeNoSequence();
        LevelLogRecord record = fromForm(lecturerId, form);
        record.setChangeNo(mapper.nextChangeNo());
        return mapper.insert(record, operator());
    }

    @Transactional
    public void update(long lecturerId, long recordId, LevelLogForm form) {
        if (mapper.find(recordId, lecturerId) == null) {
            throw new NotFoundException("等级变更记录不存在或已删除：" + recordId);
        }
        LevelLogRecord record = fromForm(lecturerId, form);
        record.setId(recordId);
        if (mapper.update(record, operator()) == 0) {
            throw new NotFoundException("等级变更记录不存在或已删除：" + recordId);
        }
    }

    @Transactional
    public void remove(long lecturerId, long recordId) {
        if (mapper.softDelete(recordId, lecturerId, operator()) == 0) {
            throw new NotFoundException("等级变更记录不存在或已删除：" + recordId);
        }
    }

    private LevelLogRecord fromForm(long lecturerId, LevelLogForm form) {
        if (!LecturerEnums.LEVELS.contains(form.levelAfter())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "变更后等级不在允许的取值里");
        }
        LevelLogRecord record = new LevelLogRecord();
        record.setLecturerId(lecturerId);
        record.setTriggerReason(blankToNull(form.triggerReason()));
        record.setChangeDesc(blankToNull(form.changeDesc()));
        record.setChangedOn(form.changedOn());
        record.setLevelAfter(form.levelAfter());
        record.setReviewer(blankToNull(form.reviewer()));
        record.setReviewComment(blankToNull(form.reviewComment()));
        return record;
    }

    private void requireLecturer(long lecturerId) {
        if (lecturers.selectById(lecturerId) == null) {
            throw new NotFoundException("讲师不存在或已删除：" + lecturerId);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
