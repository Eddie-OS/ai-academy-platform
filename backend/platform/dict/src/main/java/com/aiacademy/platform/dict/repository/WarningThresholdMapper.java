package com.aiacademy.platform.dict.repository;

import com.aiacademy.platform.dict.domain.WarningThreshold;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface WarningThresholdMapper {

    /**
     * 固定四行（需求 13.9.2）。排序用 {@code array_position} 按需求 13.4.3 的表格顺序，
     * 而不是按 id 或对象类型字典序：界面上四行的顺序应当与需求文档的表格一致，便于逐行核对。
     */
    @Select("""
            SELECT id, object_type, blue_days, red_days, updated_at, updated_by
              FROM cfg_warning_threshold
             WHERE deleted = FALSE
             ORDER BY array_position(ARRAY['AI需求', '课程', '培训计划', '案例'], object_type)
            """)
    List<WarningThreshold> findAll();

    @Select("""
            SELECT id, object_type, blue_days, red_days, updated_at, updated_by
              FROM cfg_warning_threshold
             WHERE id = #{id} AND deleted = FALSE
            """)
    WarningThreshold findById(@Param("id") long id);

    /** 只改两个天数。行不可增删（13.9.2），因此没有 insert 与 delete。 */
    @Update("""
            UPDATE cfg_warning_threshold
               SET blue_days = #{blueDays},
                   red_days = #{redDays},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int update(@Param("id") long id,
               @Param("blueDays") int blueDays,
               @Param("redDays") int redDays,
               @Param("operator") String operator);
}
