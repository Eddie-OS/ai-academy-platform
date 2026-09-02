package com.aiacademy.business.lecturer.service;

import com.aiacademy.business.lecturer.domain.CultivationForm;
import com.aiacademy.business.lecturer.domain.CultivationRecord;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.lecturer.repository.CultivationMapper;
import com.aiacademy.business.lecturer.repository.LecturerMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.common.json.JsonArrays;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 培养计划与培养记录。只落库运营填的结果，不派生任务、不改档案培养状态。
 */
@Service
public class CultivationService {

    private final CultivationMapper mapper;
    private final LecturerMapper lecturers;

    public CultivationService(CultivationMapper mapper, LecturerMapper lecturers) {
        this.mapper = mapper;
        this.lecturers = lecturers;
    }

    @Transactional(readOnly = true)
    public List<CultivationRecord> list(long lecturerId) {
        requireLecturer(lecturerId);
        return mapper.listByLecturer(lecturerId);
    }

    @Transactional
    public long create(long lecturerId, CultivationForm form) {
        requireLecturer(lecturerId);
        CultivationRecord record = fromForm(lecturerId, form);
        return mapper.insert(record, operator());
    }

    @Transactional
    public void update(long lecturerId, long recordId, CultivationForm form) {
        requireRecord(recordId, lecturerId);
        CultivationRecord record = fromForm(lecturerId, form);
        record.setId(recordId);
        if (mapper.update(record, operator()) == 0) {
            throw new NotFoundException("培养记录不存在或已删除：" + recordId);
        }
    }

    @Transactional
    public void remove(long lecturerId, long recordId) {
        if (mapper.softDelete(recordId, lecturerId, operator()) == 0) {
            throw new NotFoundException("培养记录不存在或已删除：" + recordId);
        }
    }

    private CultivationRecord fromForm(long lecturerId, CultivationForm form) {
        if (!LecturerEnums.PLAN_STATES.contains(form.planState())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "培养状态不在允许的取值里");
        }
        List<String> types = form.cultivationTypes() == null ? List.of() : form.cultivationTypes();
        for (String type : types) {
            if (!LecturerEnums.CULTIVATION_TYPES.contains(type)) {
                throw new BizException(ErrorCode.PARAM_INVALID, "培养类型不在允许的取值里：" + type);
            }
        }
        requireRange(form.plannedFrom(), form.plannedTo(), "计划培养周期");
        requireRange(form.actualFrom(), form.actualTo(), "实际培养周期");

        CultivationRecord record = new CultivationRecord();
        record.setLecturerId(lecturerId);
        record.setPlanText(blankToNull(form.planText()));
        record.setPlannedFrom(form.plannedFrom());
        record.setPlannedTo(form.plannedTo());
        record.setCultivationTypes(JsonArrays.toJson(types) == null ? "[]" : JsonArrays.toJson(types));
        record.setRecordText(blankToNull(form.recordText()));
        record.setActualFrom(form.actualFrom());
        record.setActualTo(form.actualTo());
        record.setPlanState(form.planState());
        record.setEvaluation(blankToNull(form.evaluation()));
        record.setRemark(blankToNull(form.remark()));
        return record;
    }

    private void requireLecturer(long lecturerId) {
        if (lecturers.selectById(lecturerId) == null) {
            throw new NotFoundException("讲师不存在或已删除：" + lecturerId);
        }
    }

    private void requireRecord(long recordId, long lecturerId) {
        if (mapper.find(recordId, lecturerId) == null) {
            throw new NotFoundException("培养记录不存在或已删除：" + recordId);
        }
    }

    private static void requireRange(LocalDate from, LocalDate to, String label) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new BizException(ErrorCode.PARAM_INVALID, label + "的结束日期不能早于开始日期");
        }
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
