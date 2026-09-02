package com.aiacademy.business.lecturer.service;

import com.aiacademy.business.lecturer.domain.CertificationForm;
import com.aiacademy.business.lecturer.domain.CertificationRecord;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.lecturer.repository.CertificationMapper;
import com.aiacademy.business.lecturer.repository.LecturerMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/** 认证记录。只落库，不改档案、不派生任务。 */
@Service
public class CertificationService {

    private final CertificationMapper mapper;
    private final LecturerMapper lecturers;

    public CertificationService(CertificationMapper mapper, LecturerMapper lecturers) {
        this.mapper = mapper;
        this.lecturers = lecturers;
    }

    @Transactional(readOnly = true)
    public List<CertificationRecord> list(long lecturerId) {
        requireLecturer(lecturerId);
        return mapper.listByLecturer(lecturerId);
    }

    @Transactional
    public long create(long lecturerId, CertificationForm form) {
        requireLecturer(lecturerId);
        return mapper.insert(fromForm(lecturerId, form), operator());
    }

    @Transactional
    public void update(long lecturerId, long recordId, CertificationForm form) {
        if (mapper.find(recordId, lecturerId) == null) {
            throw new NotFoundException("认证记录不存在或已删除：" + recordId);
        }
        CertificationRecord record = fromForm(lecturerId, form);
        record.setId(recordId);
        if (mapper.update(record, operator()) == 0) {
            throw new NotFoundException("认证记录不存在或已删除：" + recordId);
        }
    }

    @Transactional
    public void remove(long lecturerId, long recordId) {
        if (mapper.softDelete(recordId, lecturerId, operator()) == 0) {
            throw new NotFoundException("认证记录不存在或已删除：" + recordId);
        }
    }

    private CertificationRecord fromForm(long lecturerId, CertificationForm form) {
        if (!LecturerEnums.CERT_STATES.contains(form.certState())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "认证状态不在允许的取值里");
        }
        if (form.lecturerLevel() != null && !form.lecturerLevel().isBlank()
                && !LecturerEnums.LEVELS.contains(form.lecturerLevel())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "讲师等级不在允许的取值里");
        }
        requireRange(form.validFrom(), form.validTo(), "认证有效期");

        CertificationRecord record = new CertificationRecord();
        record.setLecturerId(lecturerId);
        record.setCertBatch(blankToNull(form.certBatch()));
        record.setLecturerLevel(blankToNull(form.lecturerLevel()));
        record.setCertState(form.certState());
        record.setReviewers(blankToNull(form.reviewers()));
        record.setOpinion(blankToNull(form.opinion()));
        record.setPassedOn(form.passedOn());
        record.setValidFrom(form.validFrom());
        record.setValidTo(form.validTo());
        return record;
    }

    private void requireLecturer(long lecturerId) {
        if (lecturers.selectById(lecturerId) == null) {
            throw new NotFoundException("讲师不存在或已删除：" + lecturerId);
        }
    }

    private static void requireRange(LocalDate from, LocalDate to, String label) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new BizException(ErrorCode.PARAM_INVALID, label + "的结束日期不能早于开始日期");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
