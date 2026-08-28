package com.aiacademy.aggregate.metrics.domain;

/**
 * 课程工作台「数据概览（本月）」三行（API-5：比率用字符串，无数据为 null）。
 *
 * @param newCourses         本月新建课程数
 * @param newCoursesMom      相对上月的环比，如 {@code ↑ 9.8%}
 * @param reviewFirstPass    本月课程一次评审通过率，如 {@code 76.3%}
 * @param reviewFirstPassMom 通过率环比
 * @param trialFirstPass     本月试讲一次合格率
 * @param trialFirstPassMom  合格率环比
 */
public record CourseMonthlyOverviewVO(
        String newCourses,
        String newCoursesMom,
        String reviewFirstPass,
        String reviewFirstPassMom,
        String trialFirstPass,
        String trialFirstPassMom) {
}
