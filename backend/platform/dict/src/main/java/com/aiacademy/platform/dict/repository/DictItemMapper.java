package com.aiacademy.platform.dict.repository;

import com.aiacademy.platform.dict.domain.DictItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface DictItemMapper {

    /**
     * 某类字典的<b>全部</b>项，含停用项——配置中心要能看到停用项才能把它启用回来。
     *
     * <p>排序按规则 DC3：排序号升序，相同排序号按编码升序。
     */
    @Select("""
            SELECT id, dict_type, item_code, item_name, parent_code, seq_no, enabled,
                   updated_at, updated_by
              FROM dict_item
             WHERE dict_type = #{dictType} AND deleted = FALSE
             ORDER BY seq_no, item_code
            """)
    List<DictItem> findAll(@Param("dictType") String dictType);

    @Select("""
            SELECT id, dict_type, item_code, item_name, parent_code, seq_no, enabled,
                   updated_at, updated_by
              FROM dict_item
             WHERE id = #{id} AND deleted = FALSE
            """)
    DictItem findById(@Param("id") long id);

    @Select("""
            INSERT INTO dict_item (dict_type, item_code, item_name, parent_code, seq_no,
                                   enabled, created_by)
            VALUES (#{dictType}, #{itemCode}, #{itemName}, #{parentCode}, #{seqNo},
                    #{enabled}, #{operator})
            RETURNING id
            """)
    long insert(@Param("dictType") String dictType,
                @Param("itemCode") String itemCode,
                @Param("itemName") String itemName,
                @Param("parentCode") String parentCode,
                @Param("seqNo") int seqNo,
                @Param("enabled") boolean enabled,
                @Param("operator") String operator);

    /**
     * 改名称、上级、排序号、启用状态。<b>不含 item_code</b>：规则 DC2 编码一经创建不可修改，
     * SQL 里没有这一列，就不存在「哪天顺手把它加进 UPDATE」的可能。
     */
    @Update("""
            UPDATE dict_item
               SET item_name = #{itemName},
                   parent_code = #{parentCode},
                   seq_no = #{seqNo},
                   enabled = #{enabled},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int update(@Param("id") long id,
               @Param("itemName") String itemName,
               @Param("parentCode") String parentCode,
               @Param("seqNo") int seqNo,
               @Param("enabled") boolean enabled,
               @Param("operator") String operator);

    @Update("""
            UPDATE dict_item
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int logicalDelete(@Param("id") long id, @Param("operator") String operator);

    /** 规则 DC4：作战单元字典不允许删到少于 1 条启用项——首页的分组维度不能为空。 */
    @Select("""
            SELECT COUNT(*) FROM dict_item
             WHERE dict_type = #{dictType} AND enabled = TRUE AND deleted = FALSE
               AND id <> #{excludeId}
            """)
    long countEnabledExcept(@Param("dictType") String dictType, @Param("excludeId") long excludeId);

    /** 同类字典内编码唯一。表上有 uk_dict_item 兜底，这里先查是为了给出可读的错误文案。 */
    @Select("""
            SELECT COUNT(*) FROM dict_item
             WHERE dict_type = #{dictType} AND item_code = #{itemCode} AND deleted = FALSE
            """)
    long countByCode(@Param("dictType") String dictType, @Param("itemCode") String itemCode);

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

    /**
     * 某类字典的启用项<b>编码</b>。
     *
     * <p>与 {@link #findEnabledNames} 并存，是因为库里两种口径都存在：导入的多选列存名称
     * （运营在 Excel 里填的就是中文名），而业务主表的 {@code domain_code}、{@code category_code}
     * 存编码（{@code DictReferenceMapper} 的引用计数按 {@code IN (code, name)} 两头兼容，
     * 正是这个历史的证据）。校验时按各自的口径查，不要在调用侧做名称与编码的互转。
     */
    @Select("""
            SELECT item_code FROM dict_item
             WHERE dict_type = #{dictType} AND enabled = TRUE AND deleted = FALSE
             ORDER BY seq_no, item_code
            """)
    List<String> findEnabledCodes(@Param("dictType") String dictType);
}
