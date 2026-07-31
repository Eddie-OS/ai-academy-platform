package com.aiacademy.app.skeleton.repository;

import com.aiacademy.app.skeleton.domain.SampleStateCount;
import com.aiacademy.app.skeleton.domain.SkeletonSample;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * 骨架示例的数据访问层。
 *
 * <p><b>规则 AR-5：原生 SQL 只允许出现在 {@code repository} 包与 {@code mapper/*.xml} 内。</b>
 * 单表 CRUD 用 MyBatis-Plus 的 {@link BaseMapper}；复杂查询写进
 * {@code resources/mapper/SkeletonSampleMapper.xml}，便于逐条与需求文档第 15 章的公式对账。
 */
@Mapper
public interface SkeletonSampleMapper extends BaseMapper<SkeletonSample> {

    /**
     * 按状态分组计数。SQL 见同名 XML —— 这条查询存在的意义是给阶段 3 的 54 个指标留一个写法范本：
     * {@code COUNT(*) FILTER (WHERE ...)} 这类 PostgreSQL 专有语法是被鼓励使用的（3.3）。
     */
    List<SampleStateCount> countByState();
}
