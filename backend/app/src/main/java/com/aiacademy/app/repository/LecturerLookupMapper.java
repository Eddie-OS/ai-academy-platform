package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 讲师的存在性与姓名查询，供跨模块编排使用。
 *
 * <p><b>为什么不在课程模块里查：</b>试讲记录的「试讲讲师」来自讲师池（需求 9.7.1 第 5 项），
 * 而 AR-1 禁止业务模块之间直接依赖——{@code business/course} 不认识 {@code biz_lecturer}。
 * 跨模块的<b>只读</b>查询走 app 层的 SQL 在本项目已有先例（{@code CourseMapper.selectPage} 直接
 * 查 {@code rel_demand_course}）；讲师数据的<b>写入</b>仍然只归讲师模块。
 */
@Mapper
public interface LecturerLookupMapper {

    @Select("SELECT COUNT(1) FROM biz_lecturer WHERE id = #{lecturerId} AND deleted = FALSE")
    boolean exists(@Param("lecturerId") long lecturerId);

    /** 试讲／场次列表要显示讲师姓名，否则页面上只有一个 ID。已逻辑删除的也查——历史场次还挂着这个人。 */
    @Select("SELECT lecturer_name FROM biz_lecturer WHERE id = #{lecturerId}")
    String nameOf(@Param("lecturerId") long lecturerId);

    /**
     * 讲师选择器的候选项，供试讲记录的「试讲讲师」下拉使用。
     *
     * <p><b>只过滤已移出讲师池的，不按培养状态过滤。</b>「可上岗」是<b>排课</b>的条件
     * （需求 C08、11.4），不是试讲的条件——试讲往往正是把「培养中」的讲师推向「可上岗」的那一步，
     * 按培养状态过滤会让新讲师永远排不上试讲。培养状态照常返回，界面显示出来供运营判断。
     *
     * <p>讲师池的完整列表页属阶段 2 D 段；这里只提供选择器需要的三个字段。
     */
    @Select("""
            SELECT id, lecturer_no, lecturer_name, employee_no, source_dept, training_state
              FROM biz_lecturer
             WHERE deleted = FALSE AND pool_state = '在池'
             ORDER BY lecturer_name
            """)
    List<LecturerOption> options();

    record LecturerOption(long id, String lecturerNo, String lecturerName, String employeeNo,
                          String sourceDept, String trainingState) {
    }

    /**
     * 排课时的讲师候选（需求 11.4 第 5 项、11.4.1 校验一）。
     *
     * <p>与 {@link #options()} 的区别正是「可上岗」这一条：试讲不看培养状态，排课看。
     * 培养状态的取值由调用方给（{@code LecturerEnums.TRAINING_QUALIFIED}），不写死在 SQL 里。
     */
    @Select("""
            SELECT id, lecturer_no, lecturer_name, employee_no, source_dept, training_state
              FROM biz_lecturer
             WHERE deleted = FALSE AND pool_state = '在池' AND training_state = #{trainingState}
             ORDER BY lecturer_name
            """)
    List<LecturerOption> schedulableOptions(@Param("trainingState") String trainingState);

    /**
     * 排课要用的讲师视图：培养状态决定能不能排（排课校验一，规则 TS4），姓名用于卡片与提示文案。
     *
     * <p>批量而非逐行：一页 20 个场次就是 20 次查询，而这里一次就够。
     */
    @Select("""
            <script>
            SELECT id, lecturer_no, lecturer_name, training_state, pool_state
              FROM biz_lecturer
             WHERE id IN
             <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
            </script>
            """)
    List<LecturerRef> findRefsByIds(@Param("ids") java.util.Collection<Long> ids);

    @Select("""
            SELECT id, lecturer_no, lecturer_name, training_state, pool_state
              FROM biz_lecturer
             WHERE id = #{id}
            """)
    LecturerRef findRefById(@Param("id") long id);

    record LecturerRef(long id, String lecturerNo, String lecturerName, String trainingState,
                       String poolState) {
    }
}
