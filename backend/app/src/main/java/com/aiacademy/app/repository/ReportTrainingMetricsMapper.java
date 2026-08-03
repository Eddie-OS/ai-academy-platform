package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;

/**
 * 总结报告「培训执行情况」段落的四个数字（需求 12.6）。
 *
 * <p><b>放在 app 模块而不是案例模块</b>：这四个数字来自培训模块的三张表，案例模块直接 JOIN
 * 它们会绕开 AR-1 建立一条 ArchUnit 看不见的依赖（同 {@code CourseRefMapper} 的理由）。
 * 案例侧的六个数字由 {@code CaseReportMapper.caseMetrics} 取，两半在应用服务里拼成正文。
 *
 * <p><b>只读。</b>报告生成不写任何培训数据。
 */
@Mapper
public interface ReportTrainingMetricsMapper {

    /**
     * @param sessionCount   区间内的培训场次数，按授课日期落在区间内计
     * @param attendeeCount  参训人次 = 签到记录条数（需求 15.1）。不去重
     * @param distinctPeople 已参训人数 = 按工号去重（需求 15.1）
     * @param avgScore       平均讲师评分。<b>只取正式授课反馈</b>，见方法注释
     * @param feedbackCount  学员反馈条数（需求 12.6「用户反馈」段落）
     */
    record TrainingSectionMetrics(long sessionCount, long attendeeCount, long distinctPeople,
                                  Double avgScore, long feedbackCount) {
    }

    /**
     * 区间内的培训执行情况。区间两端都是含的。
     *
     * <p><b>平均评分与反馈条数都必须带上「反馈场景 = 正式授课」这一条件。</b>试讲反馈与正式授课
     * 反馈存在同一张表里，两者的评分口径完全不同（需求 15.3 结尾的警告：试讲的 1 分与正式授课的
     * 5 分不得平均成 3.0）。混起来算出的平均分看上去很正常，只是低得没有道理。
     *
     * <p>场景取值由调用方给（{@code TrainingEnums}），不写死在 SQL 里。
     *
     * <p>参训人次数的是<b>签到记录</b>而不是参训名单：名单是计划要来的人，签到才是真的来了
     * （需求 15.1）。已签到的判定同样由调用方给取值。
     */
    @Select("""
            SELECT (SELECT COUNT(*) FROM biz_training_session
                     WHERE deleted = FALSE
                       AND training_date BETWEEN #{from} AND #{to}) AS session_count,
                   (SELECT COUNT(*) FROM dtl_attendance a
                      JOIN biz_training_session s ON s.id = a.session_id AND s.deleted = FALSE
                     WHERE a.deleted = FALSE AND a.attend_status = #{attended}
                       AND s.training_date BETWEEN #{from} AND #{to}) AS attendee_count,
                   (SELECT COUNT(DISTINCT a.employee_no) FROM dtl_attendance a
                      JOIN biz_training_session s ON s.id = a.session_id AND s.deleted = FALSE
                     WHERE a.deleted = FALSE AND a.attend_status = #{attended}
                       AND s.training_date BETWEEN #{from} AND #{to}) AS distinct_people,
                   (SELECT ROUND(AVG(f.score), 2) FROM dtl_training_feedback f
                      JOIN biz_training_session s ON s.id = f.session_id AND s.deleted = FALSE
                     WHERE f.deleted = FALSE AND f.feedback_scene = #{formalScene}
                       AND s.training_date BETWEEN #{from} AND #{to}) AS avg_score,
                   (SELECT COUNT(*) FROM dtl_training_feedback f
                      JOIN biz_training_session s ON s.id = f.session_id AND s.deleted = FALSE
                     WHERE f.deleted = FALSE AND f.feedback_scene = #{formalScene}
                       AND s.training_date BETWEEN #{from} AND #{to}) AS feedback_count
            """)
    TrainingSectionMetrics trainingMetrics(@Param("from") LocalDate from,
                                           @Param("to") LocalDate to,
                                           @Param("attended") String attended,
                                           @Param("formalScene") String formalScene);
}
