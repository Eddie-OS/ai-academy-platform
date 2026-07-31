package com.aiacademy.platform.audit.repository;

import com.aiacademy.platform.audit.domain.StateLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 状态流转日志。<b>只有 insert 与按对象查询两种用法</b>——没有 update、没有 delete，
 * 需求 5.11 要求它与业务对象同生命周期、永不删除。
 *
 * <p>{@code BaseMapper} 自带的 update / delete 方法在这里是不该被调用的，靠代码评审与
 * 「表上没有 deleted 列」共同兜住：真去调 deleteById 会物理删行，因此
 * {@link com.aiacademy.platform.audit.service.StateLogWriter} 是本 Mapper 唯一的写入口。
 */
@Mapper
public interface StateLogMapper extends BaseMapper<StateLog> {

    /**
     * 某对象某状态字段的完整流转序列，按时间正序。状态时间线（需求 5.11 的消费方之一）用它。
     *
     * <p>走 {@code idx_state_log_object} 索引。
     */
    @Select("""
            SELECT * FROM audit_state_log
            WHERE object_type = #{objectType} AND object_id = #{objectId}
              AND state_field = #{stateField}
            ORDER BY changed_at, id
            """)
    List<StateLog> findTimeline(@Param("objectType") String objectType,
                                @Param("objectId") long objectId,
                                @Param("stateField") String stateField);
}
