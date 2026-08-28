package com.aiacademy.aggregate.warning.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 三色灯取数。原生 SQL 集中在此（AR-5）；表名由调用方按 {@code WarningObjectKind} 传入白名单值。
 */
@Mapper
public interface WarningLightMapper {

    @Select("""
            SELECT calc_light(#{expectFinish}, #{lastChanged}, #{blueDays}, #{redDays}, #{outOfScope})
            """)
    String calcLight(@Param("expectFinish") LocalDate expectFinish,
                     @Param("lastChanged") OffsetDateTime lastChanged,
                     @Param("blueDays") int blueDays,
                     @Param("redDays") int redDays,
                     @Param("outOfScope") boolean outOfScope);

    /**
     * 快照任务：拉出一类对象的灯色入参。{@code table}/{@code expectCol}/{@code stateCol}
     * 必须来自 {@link com.aiacademy.aggregate.warning.domain.WarningObjectKind}，禁止外部拼串。
     */
    @Select("""
            SELECT id AS object_id,
                   ${expectCol} AS expect_finish,
                   last_state_changed_at,
                   ${stateCol} AS current_state,
                   ${extraCol} AS extra_state
              FROM ${table}
             WHERE deleted = FALSE
            """)
    List<Map<String, Object>> listCandidates(@Param("table") String table,
                                             @Param("expectCol") String expectCol,
                                             @Param("stateCol") String stateCol,
                                             @Param("extraCol") String extraCol);

    @Select("""
            SELECT id AS object_id,
                   ${expectCol} AS expect_finish,
                   last_state_changed_at,
                   ${stateCol} AS current_state,
                   ${extraCol} AS extra_state
              FROM ${table}
             WHERE id = #{id} AND deleted = FALSE
            """)
    Map<String, Object> findCandidate(@Param("table") String table,
                                      @Param("expectCol") String expectCol,
                                      @Param("stateCol") String stateCol,
                                      @Param("extraCol") String extraCol,
                                      @Param("id") long id);

    /**
     * 列表页批量取灯色入参，避免对每行 {@link #findCandidate}（N+1）。
     */
    @Select("""
            <script>
            SELECT id AS object_id,
                   ${expectCol} AS expect_finish,
                   last_state_changed_at,
                   ${stateCol} AS current_state,
                   ${extraCol} AS extra_state
              FROM ${table}
             WHERE deleted = FALSE
               AND id IN
            <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
            </script>
            """)
    List<Map<String, Object>> listCandidatesByIds(@Param("table") String table,
                                                  @Param("expectCol") String expectCol,
                                                  @Param("stateCol") String stateCol,
                                                  @Param("extraCol") String extraCol,
                                                  @Param("ids") List<Long> ids);

    /**
     * 预警明细取数：名称／负责人一并带出（列名来自 {@code WarningObjectKind} 白名单）。
     */
    @Select("""
            SELECT id AS object_id,
                   ${expectCol} AS expect_finish,
                   last_state_changed_at,
                   ${stateCol} AS current_state,
                   ${extraCol} AS extra_state,
                   ${nameCol} AS object_name,
                   ${ownerCol} AS owner_no
              FROM ${table}
             WHERE deleted = FALSE
            """)
    List<Map<String, Object>> listDetailCandidates(@Param("table") String table,
                                                   @Param("expectCol") String expectCol,
                                                   @Param("stateCol") String stateCol,
                                                   @Param("extraCol") String extraCol,
                                                   @Param("nameCol") String nameCol,
                                                   @Param("ownerCol") String ownerCol);
}
