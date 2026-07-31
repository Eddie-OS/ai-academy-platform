package com.aiacademy.platform.dict.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 字典项的引用计数，用于规则 DC1「已被引用时不可删，只可停用」。
 *
 * <p><b>为什么这几条 SQL 出现在 platform/dict 而不是各业务模块：</b>与
 * {@code OwnedObjectMapper}（platform/people）同一个理由——AR-2 禁止平台模块依赖业务模块，
 * 用类依赖实现就得让四个业务模块各自实现一个扩展点，为一次删除前的确认付出结构代价。
 * 这里的选择仍然是：<b>跨模块的只读聚合查询走 SQL，写操作严守模块边界</b>。
 *
 * <p><b>为什么同时按编码和名称匹配：</b>两种存法在库里同时存在，且都是有意的——
 * {@code biz_demand.domain_code} 存编码（改名不影响历史数据），
 * {@code biz_lecturer.expertise_domains} 存名称（JSONB 多选数组，导入时按名称校验，见 14.5）。
 * 只按一种匹配，另一种存法下的引用会被漏掉，于是「已被引用」的字典项被删掉，历史数据指向空值。
 * 宁可多算：多算的后果是运营被要求改用停用，少算的后果是数据静默损坏。
 */
@Mapper
public interface DictReferenceMapper {

    /**
     * 作战单元被引用的次数：需求所属领域、课程所属领域、讲师擅长领域、案例应用领域。
     *
     * <p>这四处就是需求 13.9.3 表格里「作战单元」一行的用途列所说的全部位置。
     */
    @Select("""
            SELECT (SELECT COUNT(*) FROM biz_demand
                     WHERE deleted = FALSE AND domain_code IN (#{code}, #{name}))
                 + (SELECT COUNT(*) FROM biz_course
                     WHERE deleted = FALSE AND domain_code IN (#{code}, #{name}))
                 + (SELECT COUNT(*) FROM biz_lecturer
                     WHERE deleted = FALSE
                       AND (expertise_domains @> to_jsonb(#{code}::text)
                            OR expertise_domains @> to_jsonb(#{name}::text)))
                 + (SELECT COUNT(*) FROM biz_case
                     WHERE deleted = FALSE
                       AND (domain_codes @> to_jsonb(#{code}::text)
                            OR domain_codes @> to_jsonb(#{name}::text)))
            """)
    long countCombatUnitReferences(@Param("code") String code, @Param("name") String name);

    /**
     * 课程分类被引用的次数：课程的分类标签，以及<b>下级分类</b>。
     *
     * <p>下级分类也算引用：删掉父分类会让子分类的 {@code parent_code} 指向一个不存在的编码，
     * 而界面上的层级树会静默丢掉整棵子树。
     */
    @Select("""
            SELECT (SELECT COUNT(*) FROM biz_course
                     WHERE deleted = FALSE AND category_code IN (#{code}, #{name}))
                 + (SELECT COUNT(*) FROM dict_item
                     WHERE deleted = FALSE AND dict_type = '课程分类' AND parent_code = #{code})
            """)
    long countCourseCategoryReferences(@Param("code") String code, @Param("name") String name);
}
