package com.aiacademy.aggregate.metrics.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 需求 15.5 案例互动类指标 SQL（AR-5）。
 */
@Mapper
public interface InteractionMetricsMapper {

    long viewsByCase(@Param("caseId") long caseId);

    long likesByCase(@Param("caseId") long caseId);

    long commentsByCase(@Param("caseId") long caseId);

    /**
     * 15.5 #5：累计阅读时长（单次封顶 1800 秒）÷ 浏览次数；无浏览时 {@code null}。
     */
    BigDecimal avgReadDurationSeconds();

    /** 15.5 #6：近 30 天内有浏览／点赞／评论的案例数。 */
    long countActiveCases(@Param("since") OffsetDateTime since);

    /** 15.5 #7：上架时间落在区间内的案例数。 */
    long countCasesPublishedBetween(@Param("publishedState") String publishedState,
                                    @Param("from") OffsetDateTime from,
                                    @Param("to") OffsetDateTime to);
}
