package com.aiacademy.business.kase.repository;

import com.aiacademy.business.kase.domain.CaseComment;
import com.aiacademy.business.kase.domain.CaseInteractionStats;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 三张互动明细表的读写（需求 12.4）。
 *
 * <p><b>浏览与点赞是纯追加流水：没有更新、没有删除、没有唯一约束。</b>这与常见的点赞实现相反，
 * 是业务明确要求的——共享账号下系统不知道是谁，「同一人只能赞一次」无从判断，需求 12.4 因此
 * 把点赞定义成累计计数、不去重、不可取消。看到这里没有 {@code deleteLike} 时不要补一个。
 *
 * <p>评论是三张里唯一有 {@code deleted} 列的：需求 12.3 第 19 项要求评论数不含已删除的评论，
 * 而删除评论只有运营能做（12.4 末行）。
 */
@Mapper
public interface CaseInteractionMapper {

    /**
     * 记一条浏览（需求 12.4 第 1 行）。每次打开详情页一条，<b>不去重</b>。
     *
     * @return 浏览记录主键。前端离开页面时拿它回报停留时长
     */
    @Select("""
            INSERT INTO dtl_case_view (case_id, account_type, source_ip)
            VALUES (#{caseId}, #{accountType}, #{sourceIp})
            RETURNING id
            """)
    long insertView(@Param("caseId") long caseId,
                    @Param("accountType") String accountType,
                    @Param("sourceIp") String sourceIp);

    /**
     * 补记停留时长（需求 12.3 第 21 项）。
     *
     * <p>{@code duration_seconds IS NULL} 是必须的：这条 UPDATE 由前端在离开页面时发起，
     * 而「离开」在浏览器里可能触发不止一次（切标签、刷新、关闭）。没有这个条件，同一条浏览
     * 记录的时长会被最后一次覆盖成一个很小的值，平均阅读时长随之偏低。
     */
    @Update("""
            UPDATE dtl_case_view
               SET duration_seconds = #{durationSeconds}
             WHERE id = #{viewId} AND case_id = #{caseId} AND duration_seconds IS NULL
            """)
    int updateViewDuration(@Param("caseId") long caseId,
                           @Param("viewId") long viewId,
                           @Param("durationSeconds") int durationSeconds);

    @Insert("""
            INSERT INTO dtl_case_like (case_id, account_type, source_ip)
            VALUES (#{caseId}, #{accountType}, #{sourceIp})
            """)
    int insertLike(@Param("caseId") long caseId,
                   @Param("accountType") String accountType,
                   @Param("sourceIp") String sourceIp);

    /**
     * 点赞防刷用的计数：同一 IP 对同一案例在最近一分钟内点了几次（需求 12.4「点赞防刷」）。
     *
     * <p>IP 是共享账号下唯一可用的判据。取不到 IP 时调用方不做限流——宁可少拦也不要把整栋楼
     * 出口 IP 相同的使用者当成一个人。
     */
    @Select("""
            SELECT COUNT(*) FROM dtl_case_like
             WHERE case_id = #{caseId} AND source_ip = #{sourceIp}
               AND liked_at >= NOW() - INTERVAL '1 minute'
            """)
    int countRecentLikes(@Param("caseId") long caseId, @Param("sourceIp") String sourceIp);

    @Insert("""
            INSERT INTO dtl_case_comment (case_id, account_type, signature, content, created_by, updated_by)
            VALUES (#{caseId}, #{accountType}, #{signature}, #{content}, #{operator}, #{operator})
            """)
    int insertComment(@Param("caseId") long caseId,
                      @Param("accountType") String accountType,
                      @Param("signature") String signature,
                      @Param("content") String content,
                      @Param("operator") String operator);

    /** 评论列表，最新在前。 */
    @Select("""
            SELECT id, case_id, signature, content, commented_at, account_type
              FROM dtl_case_comment
             WHERE case_id = #{caseId} AND deleted = FALSE
             ORDER BY commented_at DESC, id DESC
            """)
    List<CaseComment> findComments(@Param("caseId") long caseId);

    /** 逻辑删除一条评论。<b>仅运营</b>（需求 12.4 末行）——判定在拦截器，不在这里。 */
    @Update("""
            UPDATE dtl_case_comment
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{commentId} AND case_id = #{caseId} AND deleted = FALSE
            """)
    int softDeleteComment(@Param("caseId") long caseId,
                          @Param("commentId") long commentId,
                          @Param("operator") String operator);

    /**
     * 一个案例的四项计数。与 {@code CaseMapper.xml} 的 {@code interactionColumns} 是同一口径的
     * 两份实现：那份服务列表页的批量取数，这份服务点赞／评论后的单条刷新。
     */
    @Select("""
            SELECT (SELECT COUNT(*) FROM dtl_case_view WHERE case_id = #{caseId}) AS view_count,
                   (SELECT COUNT(*) FROM dtl_case_like WHERE case_id = #{caseId}) AS like_count,
                   (SELECT COUNT(*) FROM dtl_case_comment
                     WHERE case_id = #{caseId} AND deleted = FALSE) AS comment_count,
                   (SELECT COALESCE(SUM(duration_seconds), 0) FROM dtl_case_view
                     WHERE case_id = #{caseId}) AS read_seconds
            """)
    CaseInteractionStats stats(@Param("caseId") long caseId);
}
