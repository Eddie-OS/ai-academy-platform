package com.aiacademy.aggregate.metrics.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

/**
 * 需求 15.2 效率类指标 SQL（AR-5）。状态／结论取值由调用方参数传入。
 */
@Mapper
public interface EfficiencyMetricsMapper {

    /**
     * 需求 15.2 #1：各需求首次到达目标评审状态的自然日差（提出日 → MIN(changed_at)）。
     */
    List<Integer> demandReviewCycleDays(@Param("objectType") String objectType,
                                        @Param("stateField") String stateField,
                                        @Param("toState") String toState);

    /**
     * 需求 15.2 #2：已交付需求的交付周期天数。
     */
    List<Integer> demandDeliveryCycleDays(@Param("deliveryMarks") List<String> deliveryMarks);

    /**
     * 需求 15.2 #3：各课程首次到达主状态目标的自然日差（立项日 → MIN(changed_at)）。
     */
    List<Integer> courseDevCycleDays(@Param("objectType") String objectType,
                                     @Param("stateField") String stateField,
                                     @Param("toState") String toState);

    /** 需求 15.2 #4：每门课已完成评审轮次数（仅含至少 1 条已完成评审的课）。 */
    List<Integer> courseCompletedReviewRounds(@Param("completedState") String completedState);

    /**
     * 需求 15.2 #5：一轮评审通过数／一轮已完成数。
     *
     * @return map keys {@code numerator}/{@code denominator}
     */
    Map<String, Object> firstRoundReviewPassCounts(@Param("completedState") String completedState,
                                                   @Param("passResult") String passResult);

    /** 需求 15.2 #6：每门课已完成试讲轮次数。 */
    List<Integer> courseCompletedTrialRounds(@Param("completedState") String completedState);

    /** 需求 15.2 #7：一轮试讲课程结论合格数／一轮已完成试讲数。 */
    Map<String, Object> firstRoundTrialPassCounts(@Param("completedState") String completedState,
                                                  @Param("qualifiedConclusion") String qualifiedConclusion);

    /** 需求 15.2 #8：已上架案例的上架周期天数。 */
    List<Integer> casePublishCycleDays(@Param("publishedState") String publishedState);

    /** 需求 15.2 #9：已完成计划中按时完成数／已完成总数。 */
    Map<String, Object> planOnTimeCounts(@Param("completedState") String completedState);

    /**
     * 近 N 月需求评审周期：按首次到达目标状态的月份归属（15.2.3）。
     *
     * @return 每行 {@code monthKey}（yyyy-MM）、{@code avgDays}
     */
    List<Map<String, Object>> demandReviewCycleByMonth(@Param("objectType") String objectType,
                                                       @Param("stateField") String stateField,
                                                       @Param("toState") String toState,
                                                       @Param("fromMonth") java.time.LocalDate fromMonth);

    /** 近 N 月课程开发周期：按首次到达「发布」月份归属。 */
    List<Map<String, Object>> courseDevCycleByMonth(@Param("objectType") String objectType,
                                                    @Param("stateField") String stateField,
                                                    @Param("toState") String toState,
                                                    @Param("fromMonth") java.time.LocalDate fromMonth);

    /**
     * 近 N 月一次评审通过：按一轮评审日期归属（15.2.3）。
     *
     * @return 每行 {@code monthKey}、{@code numerator}、{@code denominator}
     */
    List<Map<String, Object>> firstRoundReviewPassByMonth(@Param("completedState") String completedState,
                                                          @Param("passResult") String passResult,
                                                          @Param("fromMonth") java.time.LocalDate fromMonth);

    /**
     * 近 N 月试讲一次合格：按一轮试讲日期归属。
     *
     * @return 每行 {@code monthKey}、{@code numerator}、{@code denominator}
     */
    List<Map<String, Object>> firstRoundTrialPassByMonth(@Param("completedState") String completedState,
                                                         @Param("qualifiedConclusion") String qualifiedConclusion,
                                                         @Param("fromMonth") java.time.LocalDate fromMonth);

    /** {@code [from, to)} 内新建的未删除课程数。 */
    long countCoursesCreatedBetween(@Param("from") java.time.LocalDate from,
                                    @Param("to") java.time.LocalDate to);

    /** 近 N 月案例上架周期：按上架时间月份归属。 */
    List<Map<String, Object>> casePublishCycleByMonth(@Param("publishedState") String publishedState,
                                                      @Param("fromMonth") java.time.LocalDate fromMonth);
}
