package com.aiacademy.business.training.repository;

import com.aiacademy.business.training.domain.FeedbackSummary;
import com.aiacademy.business.training.domain.TrainingFeedbackItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 学员反馈的页面侧读写（需求 11.7）。导入侧在 {@link TrainingImportMapper}。
 *
 * <p><b>这里没有更新反馈正文的语句，也不要加。</b>反馈原文任何账号不可修改（规则 FB1），
 * 导错了只能整批撤销重导。唯一可写的是运营备注。
 */
@Mapper
public interface TrainingFeedbackMapper {

    @Select("""
            SELECT id, session_id, submitter_no, submitter_name, submitter_dept,
                   score, content, feedback_scene, import_batch_no, imported_at,
                   ops_remark, remarked_at
              FROM dtl_training_feedback
             WHERE session_id = #{sessionId} AND deleted = FALSE
             ORDER BY imported_at DESC, id DESC
             LIMIT #{limit} OFFSET #{offset}
            """)
    List<TrainingFeedbackItem> selectPage(@Param("sessionId") long sessionId,
                                          @Param("limit") int limit,
                                          @Param("offset") int offset);

    @Select("SELECT COUNT(*) FROM dtl_training_feedback WHERE session_id = #{sessionId} AND deleted = FALSE")
    long countBySession(@Param("sessionId") long sessionId);

    /**
     * 场次平均分与各分档条数（需求 11.7 页签的汇总区）。
     *
     * <p>用 {@code FILTER} 一次扫出五个分档：五个 {@code COUNT(*) WHERE} 子查询要扫五遍表，
     * 而这是详情页每次打开都要跑的。匿名反馈同样计入（规则 FB3），因此不带任何提交人条件。
     */
    @Select("""
            SELECT COUNT(*)                                   AS total,
                   ROUND(AVG(score), 1)                       AS averageScore,
                   COUNT(*) FILTER (WHERE score = 5)          AS score5,
                   COUNT(*) FILTER (WHERE score = 4)          AS score4,
                   COUNT(*) FILTER (WHERE score = 3)          AS score3,
                   COUNT(*) FILTER (WHERE score = 2)          AS score2,
                   COUNT(*) FILTER (WHERE score = 1)          AS score1,
                   COUNT(*) FILTER (WHERE submitter_no IS NULL) AS anonymousCount
              FROM dtl_training_feedback
             WHERE session_id = #{sessionId} AND deleted = FALSE
            """)
    FeedbackSummary summary(@Param("sessionId") long sessionId);

    @Select("SELECT id, session_id FROM dtl_training_feedback WHERE id = #{id} AND deleted = FALSE")
    FeedbackRef findRef(@Param("id") long id);

    record FeedbackRef(long id, long sessionId) {
    }

    /** 运营备注（需求 11.7.2 第 10、11 项）。清空备注时备注时间一并清掉。 */
    @Update("""
            UPDATE dtl_training_feedback
               SET ops_remark = #{opsRemark,jdbcType=VARCHAR},
                   remarked_at = CASE WHEN #{opsRemark,jdbcType=VARCHAR} IS NULL THEN NULL ELSE NOW() END,
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateOpsRemark(@Param("id") long id,
                        @Param("opsRemark") String opsRemark,
                        @Param("operator") String operator);
}
