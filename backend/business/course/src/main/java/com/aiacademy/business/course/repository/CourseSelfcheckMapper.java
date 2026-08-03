package com.aiacademy.business.course.repository;

import com.aiacademy.business.course.domain.CourseSelfcheckItem;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 课程自检勾选结果（需求 9.4.2，开发 6.3.9）。
 */
@Mapper
public interface CourseSelfcheckMapper {

    /**
     * 自检页签的一整页：题库启用项与已有勾选结果的并集。
     *
     * <p><b>为什么是 FULL OUTER JOIN 的语义（这里用 UNION 实现）：</b>启用中但没勾过的题要出现
     * （待填），已勾过但题目已停用的也要出现（规则 CK5：历史记录仍可查看，只是不计入分母）。
     * 只用左连接会丢掉后者，而那正是「一年前做的自检，现在题库改版了」的常见情形。
     *
     * <p>已勾选行的题目文本取 {@code item_text_snapshot} 而不是题库当前文本——勾的是当时那句话
     * （开发 6.3.9）。
     *
     * <p>{@code completed} 的口径是规则 CK2：勾了才算数，且「必填说明」的条目还要写了说明。
     */
    @Select("""
            SELECT i.id                                          AS item_id,
                   i.group_name,
                   i.seq,
                   COALESCE(s.item_text_snapshot, i.item_text)   AS item_text,
                   i.note_requirement,
                   i.guide_text,
                   i.enabled,
                   COALESCE(s.checked, FALSE)                    AS checked,
                   s.note,
                   COALESCE(s.checked, FALSE)
                       AND (i.note_requirement <> '必填'
                            OR (s.note IS NOT NULL AND btrim(s.note) <> ''))  AS completed
              FROM cfg_selfcheck_item i
              LEFT JOIN dtl_course_selfcheck s
                     ON s.item_id = i.id AND s.course_id = #{courseId} AND s.deleted = FALSE
             WHERE i.deleted = FALSE
               AND (i.enabled = TRUE OR s.id IS NOT NULL)
             ORDER BY i.group_name, i.seq
            """)
    List<CourseSelfcheckItem> findByCourse(@Param("courseId") long courseId);

    /**
     * 保存一条勾选结果。同一课程同一题只有一行（{@code uk_course_selfcheck}），重复保存即更新。
     *
     * <p><b>题目原文在这里快照。</b>只存 item_id 的话，业务方把第 7 题改了文案之后，去年那门课的
     * 自检记录会显示新题面——而开发者当时勾的根本不是这一条（开发 6.3.9）。
     */
    @Insert("""
            INSERT INTO dtl_course_selfcheck (course_id, item_id, item_text_snapshot, checked, note,
                                              created_by, updated_by)
            VALUES (#{courseId}, #{itemId}, #{itemTextSnapshot}, #{checked}, #{note},
                    #{operator}, #{operator})
            ON CONFLICT (course_id, item_id) DO UPDATE
               SET item_text_snapshot = #{itemTextSnapshot},
                   checked = #{checked},
                   note = #{note},
                   deleted = FALSE,
                   updated_at = NOW(),
                   updated_by = #{operator}
            """)
    void save(@Param("courseId") long courseId,
              @Param("itemId") long itemId,
              @Param("itemTextSnapshot") String itemTextSnapshot,
              @Param("checked") boolean checked,
              @Param("note") String note,
              @Param("operator") String operator);
}
