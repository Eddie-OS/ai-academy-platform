package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 某个对象的<b>全部</b>状态字段的流转日志，供详情页的「状态流转日志」页签使用（需求 5.11、目标 G3）。
 *
 * <p>{@code StateLogMapper.findTimeline} 要求指定状态字段，那是效率指标的取数口径；页面要的是
 * 一门课程<b>所有</b>状态字段合在一起的时间线——运营看的是「这门课经历了什么」，不是「主状态
 * 经历了什么」。子状态与记录状态混排在一条时间线上，才能看出「提交评审」和「评审记录建档」
 * 是同一次操作的两面。
 *
 * <p>读接口对两个账号完全无差异（纪律 PMI-2）：操作审计与状态日志对用户账号也开放。
 */
@Mapper
public interface StateLogQueryMapper {

    @Select("""
            SELECT state_field, from_state, to_state, action_code, account_type,
                   changed_at, remark
              FROM audit_state_log
             WHERE object_type = #{objectType} AND object_id = #{objectId}
             ORDER BY changed_at DESC, id DESC
            """)
    List<StateLogRow> findByObject(@Param("objectType") String objectType,
                                   @Param("objectId") long objectId);

    /**
     * @param accountType OPS = 运营手动，SYSTEM = 随主状态自动置位。<b>界面要把两者区分开</b>：
     *                    一条「试讲状态：（空）→ 待试讲」如果看起来像人做的，运营会去找是谁做的，
     *                    而共享账号下这个问题没有答案
     */
    record StateLogRow(String stateField, String fromState, String toState, String actionCode,
                       String accountType, OffsetDateTime changedAt, String remark) {
    }
}
