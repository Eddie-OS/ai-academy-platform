package com.aiacademy.app.repository;

import com.aiacademy.business.lecturer.domain.LecturerListItem;
import com.aiacademy.business.lecturer.domain.LecturerQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 讲师驾驶舱的<b>跨模块只读查询</b>：讲师本体来自讲师模块，三项累计统计与授课记录、学员评价
 * 来自培训模块。
 *
 * <p><b>为什么不放在 {@code business/lecturer} 里。</b>需求 10.7 要求列表默认按累计授课次数排序、
 * 支持平均评分区间筛选，这两项只能在同一条 SQL 里算出来才能正确排序与分页。而它们的数据源是
 * {@code biz_training_session}、{@code dtl_attendance}、{@code dtl_training_feedback} —— 培训模块的表。
 * 业务模块之间不得互相依赖（AR-1），SQL 文本里的依赖 ArchUnit 看不见，更要靠位置守住。
 * 跨模块只读查询走 app 层在本项目已有先例（{@code LecturerLookupMapper}、{@code DemandCourseLinkMapper}）。
 *
 * <p><b>状态值一律作为参数传入</b>，不写在 SQL 文本里（出口准则 E2-6）。调用方从
 * {@code TrainingStateMachines} 与 {@code TrainingEnums} 取常量。
 */
@Mapper
public interface LecturerBoardMapper {

    /** 列表分页，SQL 在 {@code mapper/LecturerBoardMapper.xml}——与 countPage 必须共用同一段 WHERE。 */
    List<LecturerListItem> selectPage(@Param("q") LecturerQuery query,
                                      @Param("offset") long offset,
                                      @Param("sortColumn") String sortColumn,
                                      @Param("sortDirection") String sortDirection,
                                      @Param("finishedStates") List<String> finishedStates,
                                      @Param("attendPresent") String attendPresent);

    long countPage(@Param("q") LecturerQuery query,
                   @Param("finishedStates") List<String> finishedStates,
                   @Param("attendPresent") String attendPresent);

    LecturerListItem selectDetailById(@Param("id") long id,
                                      @Param("finishedStates") List<String> finishedStates,
                                      @Param("attendPresent") String attendPresent);

    /**
     * 讲师详情页的「授课记录」页签（需求 10.5）。
     *
     * <p><b>实时从培训场次派生，不读 {@code dtl_teaching_record}。</b>需求 10.5 说授课记录在场次
     * 变为「已结束」时自动生成，但那一刻签到还没导入——「结束」这条转换派生的正是一条「签到导入」
     * 任务。此时落库的实际参训人数必然是 0，而后续导入签到不会回头改它。实时派生则改一次签到，
     * 讲师页上的人次立刻跟着对。这条决策已记入 {@code docs/文档待修清单.md} 的 M-1。
     */
    List<TeachingRecordRow> teachingRecords(@Param("lecturerId") long lecturerId,
                                            @Param("finishedStates") List<String> finishedStates,
                                            @Param("attendPresent") String attendPresent);

    /**
     * 一条授课记录（需求 10.5 的七个字段）。
     *
     * @param attendeeCount 实际参训人数 = 该场次「已签到」的条数
     * @param avgScore      本场平均评分；无反馈时为 null，前端显示「—」
     */
    record TeachingRecordRow(long sessionId, String sessionNo, String sessionName,
                             Long courseId, String courseName, LocalDate teachingDate,
                             String sessionState, int attendeeCount, BigDecimal avgScore) {
    }

    /**
     * 讲师详情页的「学员评价」页签（需求 10.6）。
     *
     * <p>读的是 {@code dtl_training_feedback}，<b>不是 {@code dtl_student_evaluation}</b>：
     * 两张表是同一份导入数据的两个落点，需求 15.3 的讲师评分指标一律写作「学员反馈」。
     * 两边都读会让同一条反馈被数两次。
     *
     * <p><b>试讲反馈不在这里</b>（规则 R10）：它在 {@code dtl_trial_feedback}，1 分的试讲反馈与
     * 5 分的正式反馈不能平均成 3.0。
     */
    List<EvaluationRow> evaluations(@Param("lecturerId") long lecturerId);

    /** @param submitterName 提交人姓名；留空即匿名（需求 10.6 第 3 项，V1.2 依 D35 改为选填） */
    record EvaluationRow(long id, long sessionId, String sessionNo, LocalDate trainingDate,
                         String submitterName, String submitterDept, int score, String content,
                         String feedbackScene, OffsetDateTime submittedAt) {
    }

    /** 讲师被多少个培训场次引用。删除前要看它——场次的授课讲师是 NOT NULL 外键。 */
    @Select("""
            SELECT COUNT(*) FROM biz_training_session
             WHERE lecturer_id = #{lecturerId} AND deleted = FALSE
            """)
    int countSessions(@Param("lecturerId") long lecturerId);

    /** 讲师被多少条试讲记录引用。同上，试讲记录的讲师也是外键。 */
    @Select("""
            SELECT COUNT(*) FROM dtl_course_trial
             WHERE lecturer_id = #{lecturerId} AND deleted = FALSE
            """)
    int countTrials(@Param("lecturerId") long lecturerId);

    /**
     * 来源部门的去重清单，供列表页的筛选下拉用。
     *
     * <p>V1.2 把来源部门改成了自由文本（N18），没有部门表可以取选项。直接列出库里已有的取值是
     * 唯一可行的办法——也顺便让运营看见自己把「客服中心」写成过「客服中心 」。
     */
    @Select("""
            SELECT DISTINCT source_dept FROM biz_lecturer
             WHERE deleted = FALSE AND source_dept <> ''
             ORDER BY source_dept
            """)
    List<String> sourceDepts();
}
