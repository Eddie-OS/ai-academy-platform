package com.aiacademy.app.repository;

import com.aiacademy.app.web.dto.ReviewKpiVO;
import com.aiacademy.app.web.dto.ReviewRecordQuery;
import com.aiacademy.app.web.dto.ReviewRecordVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ReviewRecordMapper {

    long count(@Param("q") ReviewRecordQuery query);

    List<ReviewRecordVO> page(@Param("q") ReviewRecordQuery query);

    ReviewKpiVO kpis();
}
