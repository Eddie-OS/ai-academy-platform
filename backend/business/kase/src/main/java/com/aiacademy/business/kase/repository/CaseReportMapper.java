package com.aiacademy.business.kase.repository;

import com.aiacademy.business.kase.domain.CaseReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

/**
 * 总结报告 {@code dtl_case_report} 的读写，以及自动生成时用到的案例侧取数（需求 12.6）。
 *
 * <p><b>这里只有案例侧的数字。</b>12.6 的「培训执行情况」段落要数培训场次、参训人次与讲师评分，
 * 那三张表属培训模块，在这里 JOIN 会建立一条 ArchUnit 看不见的模块间依赖（AR-1）。那部分由
 * app 层的 {@code ReportTrainingMetricsMapper} 取，两半在应用服务里拼成正文。
 */
@Mapper
public interface CaseReportMapper {

    String COLUMNS = """
            id, report_name, period_start, period_end, generate_mode, content,
            created_at, created_by, updated_at, updated_by
            """;

    @Select("""
            INSERT INTO dtl_case_report (report_name, period_start, period_end, generate_mode,
                                         content, created_by, updated_by)
            VALUES (#{reportName}, #{periodStart}, #{periodEnd}, #{generateMode}, #{content},
                    #{operator}, #{operator})
            RETURNING id
            """)
    long insert(@Param("reportName") String reportName,
                @Param("periodStart") LocalDate periodStart,
                @Param("periodEnd") LocalDate periodEnd,
                @Param("generateMode") String generateMode,
                @Param("content") String content,
                @Param("operator") String operator);

    /**
     * 编辑报告。<b>生成方式一并置为「手动编辑」</b>：改过内容的报告不再是系统口径，
     * 读报告的人有权知道这一点（需求 12.6）。
     */
    @Update("""
            UPDATE dtl_case_report
               SET report_name = #{reportName},
                   period_start = #{periodStart},
                   period_end = #{periodEnd},
                   content = #{content},
                   generate_mode = #{generateMode},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int update(@Param("id") long id,
               @Param("reportName") String reportName,
               @Param("periodStart") LocalDate periodStart,
               @Param("periodEnd") LocalDate periodEnd,
               @Param("content") String content,
               @Param("generateMode") String generateMode,
               @Param("operator") String operator);

    @Update("""
            UPDATE dtl_case_report
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int softDelete(@Param("id") long id, @Param("operator") String operator);

    @Select("SELECT " + COLUMNS + " FROM dtl_case_report WHERE id = #{id} AND deleted = FALSE")
    CaseReport findById(@Param("id") long id);

    /** 报告列表（页面 P5-4），最新在前。报告是几十条量级，不分页。 */
    @Select("SELECT " + COLUMNS + """
             FROM dtl_case_report
            WHERE deleted = FALSE
            ORDER BY period_end DESC, id DESC
            """)
    List<CaseReport> findAll();

    /**
     * 12.6「案例应用成果」与「用户反馈」两段里属案例侧的六个数字。
     *
     * <p>区间的两端都是<b>含</b>的，因此止日一律写成 {@code < 次日}——{@code created_at} 与
     * {@code published_at} 是时间戳，直接与 DATE 比会把止日当天的数据整天漏掉。这类错误在
     * 月度报告上表现为「最后一天的案例没算进来」，而月末恰恰是集中上架的日子。
     *
     * <p>精品案例数按<b>标注</b>数，不按状态：精品是线下评审给的标注（需求 12.3 第 10 项），
     * 与案例走到哪一状态无关。
     */
    @Select("""
            SELECT (SELECT COUNT(*) FROM biz_case
                     WHERE deleted = FALSE
                       AND created_at >= #{from} AND created_at < (#{to}::DATE + 1)) AS created_cases,
                   (SELECT COUNT(*) FROM biz_case
                     WHERE deleted = FALSE
                       AND published_at >= #{from} AND published_at < (#{to}::DATE + 1)) AS published_cases,
                   (SELECT COUNT(*) FROM biz_case
                     WHERE deleted = FALSE
                       AND quality_marks @> to_jsonb(#{qualityMark}::TEXT)
                       AND created_at >= #{from} AND created_at < (#{to}::DATE + 1)) AS quality_cases,
                   (SELECT COUNT(*) FROM dtl_case_view
                     WHERE viewed_at >= #{from} AND viewed_at < (#{to}::DATE + 1)) AS view_count,
                   (SELECT COUNT(*) FROM dtl_case_like
                     WHERE liked_at >= #{from} AND liked_at < (#{to}::DATE + 1)) AS like_count,
                   (SELECT COUNT(*) FROM dtl_case_comment
                     WHERE deleted = FALSE
                       AND commented_at >= #{from} AND commented_at < (#{to}::DATE + 1)) AS comment_count
            """)
    CaseSectionMetrics caseMetrics(@Param("from") LocalDate from,
                                   @Param("to") LocalDate to,
                                   @Param("qualityMark") String qualityMark);

    record CaseSectionMetrics(long createdCases, long publishedCases, long qualityCases,
                              long viewCount, long likeCount, long commentCount) {
    }
}
