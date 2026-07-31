package com.aiacademy.business.course.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Collection;
import java.util.List;

@Mapper
public interface CourseTrialImportMapper {

    /** 存在的试讲记录 ID。试讲反馈导入的关联键是试讲记录，不是课程、不是场次（需求 14.7 A 列）。 */
    @Select("""
            <script>
            SELECT id FROM dtl_course_trial
             WHERE deleted = FALSE AND id IN
             <foreach collection="trialIds" item="id" open="(" separator="," close=")">#{id}</foreach>
            </script>
            """)
    List<Long> findExistingTrialIds(@Param("trialIds") Collection<Long> trialIds);

    /**
     * 追加一条试讲反馈（需求 14.7）。
     *
     * <p>与学员反馈是两张<b>独立的表</b>（规则 R9），且<b>不计入讲师平均评分</b>（规则 R10）：
     * 试讲的听众是评审专家与少量试听学员，人数少、目的是发现课程问题；正式培训的听众是目标学员，
     * 目的是评价授课效果。混在一起会让「讲师平均评分」这个指标失去意义。
     *
     * <p>{@code submitterNo} 为 null 即匿名（出口准则 E1-7）。
     */
    @Select("""
            INSERT INTO dtl_trial_feedback (trial_id, submitter_no, submitter_name, score, content,
                                            import_batch_no, created_by)
            VALUES (#{trialId}, #{submitterNo}, #{submitterName}, #{score}, #{content},
                    #{batchNo}, #{operator})
            RETURNING id
            """)
    long insertTrialFeedback(@Param("trialId") long trialId,
                             @Param("submitterNo") String submitterNo,
                             @Param("submitterName") String submitterName,
                             @Param("score") int score,
                             @Param("content") String content,
                             @Param("batchNo") String batchNo,
                             @Param("operator") String operator);
}
