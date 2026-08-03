package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 需求↔课程关联表（{@code rel_demand_course}，需求 8.4、规则 R1／R4）的读写。
 *
 * <p><b>为什么在 app 层而不在需求或课程模块里：</b>这张表两头各连一个业务模块，而 AR-1 禁止
 * 业务模块之间直接依赖。放进任一侧都会让那一侧的查询去 JOIN 另一侧的主表——
 * {@code business/demand} 认识 {@code biz_course} 就等于两个模块黏在了一起。跨模块的编排归
 * app 层（AR-4），跨模块的只读 SQL 走 app 层的 repository 在本项目已有先例
 * （{@link LecturerLookupMapper}）。
 *
 * <p>本表<b>没有 {@code deleted} 列</b>：解除关联即物理删除该行，变更由 {@code audit_op_log}
 * 留痕（开发 6.3.1）。因此这里的 DELETE 是真删。
 */
@Mapper
public interface DemandCourseLinkMapper {

    /**
     * 建立关联。命中唯一约束时<b>什么也不做</b>并返回 0。
     *
     * <p>重复关联不是错误：运营在需求详情页勾了课程 A，同事同时在课程 A 的详情页勾了这条需求，
     * 两个人做的是同一件事。规则 K2 要求这种情况静默视为成功，而不是弹一个「已存在」的红框。
     * {@code ON CONFLICT DO NOTHING} 让判重发生在数据库的唯一约束上，而不是「先查后插」——
     * 后者在并发下仍会撞约束。
     *
     * @return 实际插入的行数：1 是新建，0 是已经关联过
     */
    @Select("""
            INSERT INTO rel_demand_course (demand_id, course_id, link_note, created_by)
            VALUES (#{demandId}, #{courseId}, #{linkNote}, #{operator})
            ON CONFLICT (demand_id, course_id) DO NOTHING
            RETURNING 1
            """)
    Integer insertIfAbsent(@Param("demandId") long demandId,
                           @Param("courseId") long courseId,
                           @Param("linkNote") String linkNote,
                           @Param("operator") String operator);

    @Delete("DELETE FROM rel_demand_course WHERE demand_id = #{demandId} AND course_id = #{courseId}")
    int delete(@Param("demandId") long demandId, @Param("courseId") long courseId);

    @Select("""
            SELECT link_note FROM rel_demand_course
             WHERE demand_id = #{demandId} AND course_id = #{courseId}
            """)
    String noteOf(@Param("demandId") long demandId, @Param("courseId") long courseId);

    /** 关联说明是关联行上唯一可改的字段，改它不影响关联关系本身。 */
    @Update("""
            UPDATE rel_demand_course SET link_note = #{linkNote}
             WHERE demand_id = #{demandId} AND course_id = #{courseId}
            """)
    int updateNote(@Param("demandId") long demandId,
                   @Param("courseId") long courseId,
                   @Param("linkNote") String linkNote);

    /**
     * 需求详情页「关联课程」页签（需求 8.4 界面要求第 1 行）：课程名称、主状态、课程负责人。
     *
     * <p>已逻辑删除的课程不出现在列表里，但关联行仍留在表上——课程被删除不等于当初的关联是错的，
     * 而删掉关联行会让 {@code audit_op_log} 里的「解除关联」凭空多出一条谁也没做过的记录。
     */
    @Select("""
            SELECT c.id AS course_id, c.course_no, c.course_name, c.main_state,
                   c.owner_no, owner.employee_name AS owner_name,
                   rc.link_note, rc.created_at, rc.created_by
              FROM rel_demand_course rc
              JOIN biz_course c ON c.id = rc.course_id AND c.deleted = FALSE
              LEFT JOIN org_employee owner ON owner.employee_no = c.owner_no AND owner.deleted = FALSE
             WHERE rc.demand_id = #{demandId}
             ORDER BY rc.created_at DESC, rc.id DESC
            """)
    List<LinkedCourse> coursesOf(@Param("demandId") long demandId);

    /** 课程详情页「关联需求」页签：需求名称、评审状态、分流出口、需求负责人。 */
    @Select("""
            SELECT d.id AS demand_id, d.demand_no, d.demand_name, d.review_state, d.outlet,
                   d.owner_no, owner.employee_name AS owner_name,
                   rc.link_note, rc.created_at, rc.created_by
              FROM rel_demand_course rc
              JOIN biz_demand d ON d.id = rc.demand_id AND d.deleted = FALSE
              LEFT JOIN org_employee owner ON owner.employee_no = d.owner_no AND owner.deleted = FALSE
             WHERE rc.course_id = #{courseId}
             ORDER BY rc.created_at DESC, rc.id DESC
            """)
    List<LinkedDemand> demandsOf(@Param("courseId") long courseId);

    record LinkedCourse(long courseId, String courseNo, String courseName, String mainState,
                        String ownerNo, String ownerName, String linkNote,
                        OffsetDateTime createdAt, String createdBy) {
    }

    record LinkedDemand(long demandId, String demandNo, String demandName, String reviewState,
                        String outlet, String ownerNo, String ownerName, String linkNote,
                        OffsetDateTime createdAt, String createdBy) {
    }
}
