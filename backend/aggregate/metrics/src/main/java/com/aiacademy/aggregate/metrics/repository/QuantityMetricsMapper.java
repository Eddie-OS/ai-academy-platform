package com.aiacademy.aggregate.metrics.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 需求 15.1 数量类指标 SQL（AR-5）。状态／枚举取值一律由调用方参数传入，本接口不写字面量。
 */
@Mapper
public interface QuantityMetricsMapper {

    // ---- 需求 15.1 #1～#5b ----

    long countDemands();

    List<Map<String, Object>> countDemandsByReviewState(@Param("states") List<String> states);

    List<Map<String, Object>> countDemandsByDevState(@Param("outlet") String outlet,
                                                    @Param("states") List<String> states);

    List<Map<String, Object>> countDemandsByOutlet(@Param("outlets") List<String> outlets);

    /** 需求 15.1 #5：交付使用标记已置位（已交付／已归档）。 */
    long countDemandsWithDeliveryMarks(@Param("marks") List<String> marks);

    long countDemandsByAcceptanceState(@Param("acceptanceState") String acceptanceState);

    long countDemandsByDevStateSingle(@Param("outlet") String outlet, @Param("devState") String devState);

    // ---- 课程 15.1 #6～#10b ----

    /** 未删除课程全量（工作台「课程总数」，含三个终态）。15.1 #6 仍走 {@link #countCoursesExcluding}。 */
    long countCourses();

    long countCoursesExcluding(@Param("excludeState") String excludeState);

    long countCoursesInStates(@Param("states") List<String> states);

    long countCoursesByState(@Param("state") String state);

    /**
     * 按试讲子状态计数。总看板讲师卡的「待试讲」用它（业务改版 V-70）。
     *
     * <p>数的是<b>课程</b>而不是讲师：讲师表上没有「待试讲」这个状态，只有一个由试讲结论
     * 写入的试讲合格标记（{@code trial_qualified}）。业务确认过这个口径——卡上问的是
     * 「有多少场试讲在等着」，那是课程侧的事实。
     */
    long countCoursesByTrialState(@Param("trialState") String trialState);

    long countCoursesExpired();

    long countCoursesExpiringWithinDays(@Param("days") int days);

    // ---- 讲师 15.1 #11～#12b ----

    long countLecturersInPool(@Param("poolState") String poolState);

    long countLecturersTrialQualifiedInPool(@Param("poolState") String poolState);

    long countLecturersByTrainingInPool(@Param("poolState") String poolState,
                                        @Param("trainingState") String trainingState);

    List<Map<String, Object>> countLecturersByTrainingStatesInPool(
            @Param("poolState") String poolState,
            @Param("trainingStates") List<String> trainingStates);

    // ---- 培训 15.1 #13～#16b + 7.4 本周计划 + 任务派生 ----

    long countPlansOverlapping(@Param("rangeStart") LocalDate rangeStart,
                               @Param("rangeEnd") LocalDate rangeEnd);

    long countSessionsByState(@Param("sessionState") String sessionState);

    long countSessionsInMonth(@Param("monthStart") LocalDate monthStart,
                              @Param("monthEnd") LocalDate monthEnd);

    long countAttendancePresentInMonth(@Param("attendStatus") String attendStatus,
                                       @Param("monthStart") LocalDate monthStart,
                                       @Param("monthEnd") LocalDate monthEnd);

    long countAttendancePresent(@Param("attendStatus") String attendStatus);

    long countDistinctAttendeesPresent(@Param("attendStatus") String attendStatus);

    long countOpenTasksByType(@Param("taskType") String taskType,
                              @Param("openStates") List<String> openStates);

    // ---- 案例 15.1 #17～#19 ----

    long countCases();

    long countCasesByState(@Param("caseState") String caseState);

    long countCasesWithQualityMark(@Param("qualityMark") String qualityMark);

    // ---- 讲师驾驶舱卡 15.3 #5／#7（授课从场次派生，M-1）----

    /**
     * 需求 15.3 #5「本月授课人次」：COUNT(本月已结束／已归档场次)。
     *
     * <p>公式中文名含「人次」，实为场次条数（核对表注明）；不是 SUM 签到。
     */
    long countTeachingSessionsInMonth(@Param("finishedStates") List<String> finishedStates,
                                      @Param("monthStart") LocalDate monthStart,
                                      @Param("monthEnd") LocalDate monthEnd);

    /** 需求 15.3 #7：近 N 天内有结束态授课场次的 DISTINCT 讲师数。 */
    long countActiveLecturers(@Param("finishedStates") List<String> finishedStates,
                              @Param("sinceDate") LocalDate sinceDate);

    // ---- 案例驾驶舱卡 15.5 #1～#3（全库）----

    long countCaseViews();

    long countCaseLikes();

    long countCaseComments();
}
