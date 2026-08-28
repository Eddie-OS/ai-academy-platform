package com.aiacademy.platform.escalation.repository;

import com.aiacademy.platform.escalation.domain.EscalationConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalTime;

@Mapper
public interface EscalationConfigMapper {

    @Select("""
            SELECT id, cycle_weekday AS cycleWeekday, cycle_time AS cycleTime,
                   list_enabled AS listEnabled, append_blue AS appendBlue,
                   append_yellow AS appendYellow, append_red AS appendRed,
                   template_text AS templateText, min_interval_hours AS minIntervalHours,
                   pre_session_days AS preSessionDays,
                   updated_at AS updatedAt, updated_by AS updatedBy
              FROM cfg_escalation
             WHERE id = 1 AND deleted = FALSE
            """)
    EscalationConfig find();

    @Update("""
            UPDATE cfg_escalation
               SET cycle_weekday = #{cycleWeekday},
                   cycle_time = #{cycleTime},
                   list_enabled = #{listEnabled},
                   append_blue = #{appendBlue},
                   append_yellow = #{appendYellow},
                   append_red = #{appendRed},
                   template_text = #{templateText},
                   min_interval_hours = #{minIntervalHours},
                   pre_session_days = #{preSessionDays},
                   updated_at = NOW(),
                   updated_by = #{updatedBy}
             WHERE id = 1 AND deleted = FALSE
            """)
    int update(@Param("cycleWeekday") int cycleWeekday,
               @Param("cycleTime") LocalTime cycleTime,
               @Param("listEnabled") boolean listEnabled,
               @Param("appendBlue") boolean appendBlue,
               @Param("appendYellow") boolean appendYellow,
               @Param("appendRed") boolean appendRed,
               @Param("templateText") String templateText,
               @Param("minIntervalHours") int minIntervalHours,
               @Param("preSessionDays") int preSessionDays,
               @Param("updatedBy") String updatedBy);
}
