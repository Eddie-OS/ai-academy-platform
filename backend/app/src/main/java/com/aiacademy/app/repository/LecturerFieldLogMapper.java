package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 讲师详情「状态流转日志」页签。读的是操作审计，不是 {@code audit_state_log}。
 *
 * <p>讲师没有状态机（TS1／TS2）。上岗、培养、认证的改值走编辑，只写 {@code audit_op_log}，
 * 以免把自由枚举写进流转日志、污染按流转算的效率指标。
 */
@Mapper
public interface LecturerFieldLogMapper {

    @Select("""
            SELECT field_name, old_value, new_value, account_type,
                   operator_no, operator_name, operated_at, remark
              FROM audit_op_log
             WHERE object_type = #{objectType}
               AND object_id = #{objectId}
               AND field_name IN ('上岗状态', '培养状态', '认证状态')
             ORDER BY operated_at DESC, id DESC
            """)
    List<FieldLogRow> listStatusChanges(@Param("objectType") String objectType,
                                        @Param("objectId") long objectId);

    record FieldLogRow(String fieldName, String oldValue, String newValue, String accountType,
                       String operatorNo, String operatorName, OffsetDateTime operatedAt,
                       String remark) {
    }
}
