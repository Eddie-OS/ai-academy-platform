package com.aiacademy.platform.audit.repository;

import com.aiacademy.platform.audit.domain.OpLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 操作审计日志。同样只写不改不删。
 *
 * <p>按对象翻页查询在阶段 3 的审计查询页才需要，那时再加方法；现在只有 insert 有调用方。
 */
@Mapper
public interface OpLogMapper extends BaseMapper<OpLog> {
}
