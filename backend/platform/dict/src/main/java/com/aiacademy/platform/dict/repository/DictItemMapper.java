package com.aiacademy.platform.dict.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface DictItemMapper {

    /**
     * 某类字典的启用项名称。
     *
     * <p>只查启用项：规则 DC1「字典项停用后不影响已引用它的历史数据，仅在新建时不再可选」——
     * 导入是新建，所以停用项不可选。
     */
    @Select("""
            SELECT item_name FROM dict_item
             WHERE dict_type = #{dictType} AND enabled = TRUE AND deleted = FALSE
             ORDER BY seq_no, item_code
            """)
    List<String> findEnabledNames(@Param("dictType") String dictType);
}
