package com.aiacademy.platform.dict.repository;

import com.aiacademy.platform.dict.domain.SelfcheckItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface SelfcheckItemMapper {

    /** 配置中心看全部（含停用项）；阶段 2 的课程自检页面只取启用项，届时另加一个方法。 */
    @Select("""
            SELECT id, group_name, seq, item_text, note_requirement, guide_text,
                   locked, enabled, updated_at, updated_by
              FROM cfg_selfcheck_item
             WHERE deleted = FALSE
             ORDER BY group_name, seq
            """)
    List<SelfcheckItem> findAll();

    @Select("""
            SELECT id, group_name, seq, item_text, note_requirement, guide_text,
                   locked, enabled, updated_at, updated_by
              FROM cfg_selfcheck_item
             WHERE id = #{id} AND deleted = FALSE
            """)
    SelfcheckItem findById(@Param("id") long id);

    @Select("""
            INSERT INTO cfg_selfcheck_item (group_name, seq, item_text, note_requirement,
                                            guide_text, locked, enabled, created_by)
            VALUES (#{groupName}, #{seq}, #{itemText}, #{noteRequirement},
                    #{guideText}, FALSE, #{enabled}, #{operator})
            RETURNING id
            """)
    long insert(@Param("groupName") String groupName,
                @Param("seq") int seq,
                @Param("itemText") String itemText,
                @Param("noteRequirement") String noteRequirement,
                @Param("guideText") String guideText,
                @Param("enabled") boolean enabled,
                @Param("operator") String operator);

    /**
     * 改分组、排序、题目文本、说明必填性、填写指引、启用状态。
     *
     * <p><b>{@code locked} 不在可改列里</b>：锁定标记表达的是「这一条来自需求文档 9.4.1」，
     * 是一个事实而不是一项偏好。做成可改的开关，等于给「先解锁再停用」留了一条路，
     * 那 5 条的保护就形同虚设。
     */
    @Update("""
            UPDATE cfg_selfcheck_item
               SET group_name = #{groupName},
                   seq = #{seq},
                   item_text = #{itemText},
                   note_requirement = #{noteRequirement},
                   guide_text = #{guideText},
                   enabled = #{enabled},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int update(@Param("id") long id,
               @Param("groupName") String groupName,
               @Param("seq") int seq,
               @Param("itemText") String itemText,
               @Param("noteRequirement") String noteRequirement,
               @Param("guideText") String guideText,
               @Param("enabled") boolean enabled,
               @Param("operator") String operator);

    @Update("""
            UPDATE cfg_selfcheck_item
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int logicalDelete(@Param("id") long id, @Param("operator") String operator);

    /** 排序号全表唯一（uk_selfcheck_item_seq）。先查是为了给出可读文案而不是约束冲突。 */
    @Select("""
            SELECT COUNT(*) FROM cfg_selfcheck_item
             WHERE seq = #{seq} AND id <> #{excludeId}
            """)
    long countBySeq(@Param("seq") int seq, @Param("excludeId") long excludeId);

    /**
     * 某条题目已被多少条课程自检记录引用（规则 CK5）。
     *
     * <p>被引用过的题目<b>只能停用不能删</b>：{@code dtl_course_selfcheck} 虽然快照了题目文本
     * （开发 6.3.9），但删掉题库行会让「按题目统计各课程勾选情况」这类查询丢掉整列。
     * 表在阶段 2 才有数据，这条现在恒为 0。
     */
    @Select("SELECT COUNT(*) FROM dtl_course_selfcheck WHERE item_id = #{itemId}")
    long countUsages(@Param("itemId") long itemId);
}
