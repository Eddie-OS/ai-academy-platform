package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/**
 * 待催办清单五维度计数与辅助查询（需求 13.5.3）。SQL 集中在此（AR-5）。
 *
 * <p>所有状态条件都以参数传入，SQL 文本里不出现状态值（出口准则 E2-6）。状态值由调用方从
 * {@code platform/statemachine} 的常量与终态集合取得。
 */
@Mapper
public interface EscalationPendingMapper {

    @Select("""
            SELECT employee_no AS empNo, employee_name AS name
              FROM org_employee
             WHERE deleted = FALSE AND employee_no = #{empNo}
            """)
    OwnerRow findOwner(@Param("empNo") String empNo);

    @Select("""
            <script>
            SELECT COUNT(*) FILTER (WHERE task_state IN
                     <foreach item="s" collection="openStates" open="(" separator="," close=")">#{s}</foreach>
                   ) AS openCount,
                   COUNT(*) FILTER (
                       WHERE task_state IN
                         <foreach item="s" collection="openStates" open="(" separator="," close=")">#{s}</foreach>
                         AND due_date IS NOT NULL AND due_date &lt; CURRENT_DATE
                   ) AS overdueCount
              FROM sys_task
             WHERE deleted = FALSE
               AND COALESCE(owner_no, '') = COALESCE(#{ownerNo}, '')
            </script>
            """)
    TaskDimCount taskCounts(@Param("ownerNo") String ownerNo,
                            @Param("openStates") Collection<String> openStates);

    @Select("""
            SELECT
              COUNT(*) FILTER (WHERE acceptance_state = #{acceptancePending}) AS pendingAcceptance,
              COUNT(*) FILTER (
                  WHERE calc_light(expect_finish_date, last_state_changed_at,
                                  #{blueDays}, #{redDays},
                                  delivery_mark = #{deliveryArchived}
                                  OR outlet = #{outletRejected}) = 'BLUE'
              ) AS blueCount,
              COUNT(*) FILTER (
                  WHERE calc_light(expect_finish_date, last_state_changed_at,
                                  #{blueDays}, #{redDays},
                                  delivery_mark = #{deliveryArchived}
                                  OR outlet = #{outletRejected}) = 'YELLOW'
              ) AS yellowCount,
              COUNT(*) FILTER (
                  WHERE calc_light(expect_finish_date, last_state_changed_at,
                                  #{blueDays}, #{redDays},
                                  delivery_mark = #{deliveryArchived}
                                  OR outlet = #{outletRejected}) = 'RED'
              ) AS redCount
              FROM biz_demand
             WHERE deleted = FALSE
               AND COALESCE(owner_no, '') = COALESCE(#{ownerNo}, '')
            """)
    DemandDimCount demandCounts(@Param("ownerNo") String ownerNo,
                                @Param("blueDays") int blueDays,
                                @Param("redDays") int redDays,
                                @Param("acceptancePending") String acceptancePending,
                                @Param("deliveryArchived") String deliveryArchived,
                                @Param("outletRejected") String outletRejected);

    @Select("""
            <script>
            SELECT
              COUNT(*) FILTER (WHERE main_state = #{reviewDecision}) AS pendingReview,
              COUNT(*) FILTER (WHERE trial_state = #{trialPending}) AS pendingTrial,
              COUNT(*) FILTER (WHERE main_state = #{optimize}) AS pendingOptimize,
              COUNT(*) FILTER (
                  WHERE validity_end_date IS NOT NULL
                    AND validity_end_date BETWEEN CURRENT_DATE
                        AND CURRENT_DATE + #{validityDays}
              ) AS validitySoon
              FROM biz_course
             WHERE deleted = FALSE
               AND COALESCE(owner_no, '') = COALESCE(#{ownerNo}, '')
               AND main_state NOT IN
                 <foreach item="s" collection="terminalStates" open="(" separator="," close=")">#{s}</foreach>
            </script>
            """)
    CourseDimCount courseCounts(@Param("ownerNo") String ownerNo,
                                @Param("reviewDecision") String reviewDecision,
                                @Param("trialPending") String trialPending,
                                @Param("optimize") String optimize,
                                @Param("validityDays") int validityDays,
                                @Param("terminalStates") Collection<String> terminalStates);

    @Select("""
            <script>
            SELECT
              COUNT(*) FILTER (WHERE s.session_state = #{pendingStart}) AS pendingStart,
              COUNT(*) FILTER (WHERE s.session_state = #{finished}) AS pendingAttendance,
              COUNT(*) FILTER (WHERE s.session_state = #{finished}) AS pendingArchive
              FROM biz_training_session s
              JOIN biz_training_plan p ON p.id = s.plan_id AND p.deleted = FALSE
             WHERE s.deleted = FALSE
               AND COALESCE(p.owner_no, '') = COALESCE(#{ownerNo}, '')
               AND s.session_state NOT IN
                 <foreach item="st" collection="terminalStates" open="(" separator="," close=")">#{st}</foreach>
            </script>
            """)
    TrainingDimCount trainingCounts(@Param("ownerNo") String ownerNo,
                                    @Param("pendingStart") String pendingStart,
                                    @Param("finished") String finished,
                                    @Param("terminalStates") Collection<String> terminalStates);

    @Select("""
            SELECT
              COUNT(*) FILTER (WHERE case_state = #{pendingOrganize}) AS pendingOrganize,
              COUNT(*) FILTER (WHERE case_state = #{organizing}) AS organizing,
              COUNT(*) FILTER (WHERE case_state = #{pendingAudit}) AS pendingAudit
              FROM biz_case
             WHERE deleted = FALSE
               AND COALESCE(owner_no, '') = COALESCE(#{ownerNo}, '')
               AND case_state <> #{published}
            """)
    CaseDimCount caseCounts(@Param("ownerNo") String ownerNo,
                            @Param("pendingOrganize") String pendingOrganize,
                            @Param("organizing") String organizing,
                            @Param("pendingAudit") String pendingAudit,
                            @Param("published") String published);

    @Select("""
            SELECT s.id AS objectId,
                   COALESCE(s.session_name, s.session_no) AS objectName,
                   s.session_state AS currentState,
                   p.owner_no AS ownerNo,
                   s.training_date AS sessionDate
              FROM biz_training_session s
              JOIN biz_training_plan p ON p.id = s.plan_id AND p.deleted = FALSE
             WHERE s.deleted = FALSE
               AND s.session_state = #{pendingStart}
               AND s.training_date IS NOT NULL
               AND s.training_date BETWEEN CURRENT_DATE
                   AND (CURRENT_DATE + #{preDays})
            """)
    List<PreSessionRow> preSessions(@Param("preDays") int preDays,
                                    @Param("pendingStart") String pendingStart);

    @Select("""
            <script>
            SELECT id AS objectId, due_date AS dueDate, task_state AS taskState,
                   title, owner_no AS ownerNo, object_type AS refObjectType, object_id AS refObjectId
              FROM sys_task
             WHERE deleted = FALSE
               AND task_state IN
                 <foreach item="s" collection="openStates" open="(" separator="," close=")">#{s}</foreach>
               AND due_date IS NOT NULL
               AND due_date &lt; CURRENT_DATE
            </script>
            """)
    List<OverdueTaskRow> overdueTasks(@Param("openStates") Collection<String> openStates);

    @Select("SELECT created_at FROM biz_demand WHERE id = #{id} AND deleted = FALSE")
    java.time.OffsetDateTime demandCreatedAt(@Param("id") long id);

    @Select("SELECT created_at FROM biz_course WHERE id = #{id} AND deleted = FALSE")
    java.time.OffsetDateTime courseCreatedAt(@Param("id") long id);

    @Select("SELECT created_at FROM biz_training_plan WHERE id = #{id} AND deleted = FALSE")
    java.time.OffsetDateTime planCreatedAt(@Param("id") long id);

    @Select("SELECT created_at FROM biz_case WHERE id = #{id} AND deleted = FALSE")
    java.time.OffsetDateTime caseCreatedAt(@Param("id") long id);

    record OwnerRow(String empNo, String name) {
    }

    record TaskDimCount(long openCount, long overdueCount) {
    }

    record DemandDimCount(long pendingAcceptance, long blueCount, long yellowCount, long redCount) {
    }

    record CourseDimCount(long pendingReview, long pendingTrial, long pendingOptimize, long validitySoon) {
    }

    record TrainingDimCount(long pendingStart, long pendingAttendance, long pendingArchive) {
    }

    record CaseDimCount(long pendingOrganize, long organizing, long pendingAudit) {
    }

    record PreSessionRow(long objectId, String objectName, String currentState,
                         String ownerNo, LocalDate sessionDate) {
    }

    record OverdueTaskRow(long objectId, LocalDate dueDate, String taskState, String title,
                          String ownerNo, String refObjectType, Long refObjectId) {
    }
}
