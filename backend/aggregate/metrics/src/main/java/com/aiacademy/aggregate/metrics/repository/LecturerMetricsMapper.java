package com.aiacademy.aggregate.metrics.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;

/**
 * 需求 15.3 讲师类指标 SQL（AR-5）。授课从 {@code biz_training_session} 派生（M-1）；
 * 正式评分只读 {@code dtl_training_feedback}，试讲反馈只读 {@code dtl_trial_feedback}（R10）。
 */
@Mapper
public interface LecturerMetricsMapper {

    /** 15.3 #1：讲师累计授课次数。 */
    long teachingCountByLecturer(@Param("lecturerId") long lecturerId,
                                 @Param("finishedStates") List<String> finishedStates);

    /** 15.3 #2：讲师累计学员人次（各结束场次已签到人数之和）。 */
    long attendeeSumByLecturer(@Param("lecturerId") long lecturerId,
                               @Param("finishedStates") List<String> finishedStates,
                               @Param("attendPresent") String attendPresent);

    /** 15.3 #3：讲师平均评分；无反馈时 {@code null}。 */
    BigDecimal avgScoreByLecturer(@Param("lecturerId") long lecturerId);

    /** 15.3 #4：讲师本场平均评分。 */
    BigDecimal avgScoreByLecturerSession(@Param("lecturerId") long lecturerId,
                                         @Param("sessionId") long sessionId);

    /** 15.3 #6：全局平均讲师评分。 */
    BigDecimal avgGlobalLecturerScore();

    /** 15.3 #8：试讲反馈平均分（按试讲记录）。 */
    BigDecimal avgTrialFeedbackScore(@Param("trialId") long trialId);
}
