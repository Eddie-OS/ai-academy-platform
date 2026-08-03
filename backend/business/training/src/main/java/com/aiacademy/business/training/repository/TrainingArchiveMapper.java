package com.aiacademy.business.training.repository;

import com.aiacademy.business.training.domain.TrainingArchive;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 培训归档记录的读写（需求 11.6）。每个场次至多一条，由唯一索引
 * {@code uk_training_archive_session} 保证。
 */
@Mapper
public interface TrainingArchiveMapper {

    @Select("""
            SELECT id, session_id, live_link, video_link, minutes_text,
                   archive_completed, completed_at, updated_at, updated_by
              FROM dtl_training_archive
             WHERE session_id = #{sessionId} AND deleted = FALSE
            """)
    TrainingArchive selectBySession(@Param("sessionId") long sessionId);

    /** 场次列表／详情要显示「是否已归档完成」时批量取，避免逐行查。 */
    @Select("""
            <script>
            SELECT session_id
              FROM dtl_training_archive
             WHERE deleted = FALSE AND archive_completed = TRUE AND session_id IN
             <foreach collection="sessionIds" item="id" open="(" separator="," close=")">#{id}</foreach>
            </script>
            """)
    List<Long> findCompletedSessionIds(@Param("sessionIds") List<Long> sessionIds);

    /**
     * 新建归档记录。
     *
     * <p>唯一索引带 {@code WHERE deleted = FALSE}，是部分索引，因此 {@code ON CONFLICT} 要写成
     * 带同样条件的索引推断形式，否则 PostgreSQL 找不到可用的仲裁索引。冲突时只可能是两名运营
     * 同时首次保存，后到的那次走 DO UPDATE 覆盖。
     */
    @Update("""
            INSERT INTO dtl_training_archive (session_id, live_link, video_link, minutes_text,
                                              archive_completed, completed_at, created_by)
            VALUES (#{sessionId}, #{liveLink}, #{videoLink}, #{minutesText},
                    #{archiveCompleted}, #{completedAt}, #{operator})
            ON CONFLICT (session_id) WHERE deleted = FALSE DO UPDATE
               SET live_link = EXCLUDED.live_link,
                   video_link = EXCLUDED.video_link,
                   minutes_text = EXCLUDED.minutes_text,
                   archive_completed = EXCLUDED.archive_completed,
                   completed_at = EXCLUDED.completed_at,
                   updated_at = NOW(),
                   updated_by = #{operator}
            """)
    int upsert(@Param("sessionId") long sessionId,
               @Param("liveLink") String liveLink,
               @Param("videoLink") String videoLink,
               @Param("minutesText") String minutesText,
               @Param("archiveCompleted") boolean archiveCompleted,
               @Param("completedAt") java.time.OffsetDateTime completedAt,
               @Param("operator") String operator);
}
