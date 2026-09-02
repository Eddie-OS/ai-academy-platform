package com.aiacademy.app.web.dto;

import com.aiacademy.app.repository.LecturerFieldLogMapper;

import java.time.OffsetDateTime;

public record LecturerFieldLogVO(
        String fieldName,
        String oldValue,
        String newValue,
        String accountType,
        String operatorNo,
        String operatorName,
        OffsetDateTime operatedAt,
        String remark) {

    public static LecturerFieldLogVO of(LecturerFieldLogMapper.FieldLogRow row) {
        return new LecturerFieldLogVO(
                row.fieldName(), row.oldValue(), row.newValue(), row.accountType(),
                row.operatorNo(), row.operatorName(), row.operatedAt(), row.remark());
    }
}
