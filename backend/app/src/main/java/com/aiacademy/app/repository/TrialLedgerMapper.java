package com.aiacademy.app.repository;

import com.aiacademy.app.web.dto.TrialLedgerQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * 试讲台账（需求 10.2 页面 P3-3）：全部课程的试讲记录汇总视图。
 *
 * <p>一条记录横跨三个模块——{@code dtl_course_trial} 属课程、{@code biz_lecturer} 属讲师、
 * 课程名来自 {@code biz_course}。业务模块之间不得互相依赖（AR-1），因此汇总查询落在 app 层。
 *
 * <p><b>台账是只读的。</b>录入结论仍走课程详情页的试讲页签（{@code CourseTrialController}）——
 * 那条路径同时推进试讲记录状态、课程试讲子状态与讲师试讲合格标记，三件事在一个事务里。
 * 在台账上另开一个录入口会出现第二条写路径，两条路径迟早只有一条是完整的。
 */
@Mapper
public interface TrialLedgerMapper {

    List<TrialLedgerRow> selectPage(@Param("q") TrialLedgerQuery query,
                                    @Param("offset") long offset,
                                    @Param("sortColumn") String sortColumn,
                                    @Param("sortDirection") String sortDirection);

    long countPage(@Param("q") TrialLedgerQuery query);

    /**
     * 台账的一行（需求 9.7.1 试讲记录字段清单 + 课程与讲师的展示名）。
     *
     * @param inconsistent 双结论不一致，库里是生成列（开发 6.3.4），不在应用层算
     */
    record TrialLedgerRow(long id, long courseId, String courseNo, String courseName,
                          int roundNo, LocalDate trialDate,
                          long lecturerId, String lecturerNo, String lecturerName,
                          String participants, String courseConclusion, String lecturerConclusion,
                          boolean inconsistent, String expertOpinion, String issueList,
                          String recordState,
                          String trialSatisfaction, String trialOptimizeAdvice,
                          LocalDate trialScheduledDate) {
    }
}
