package com.aiacademy.business.demand.repository;

import com.aiacademy.business.demand.domain.ValueReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface ValueReportMapper {

    List<ValueReport> selectByYearPrefix(@Param("yearPrefix") String yearPrefix);

    ValueReport findById(@Param("id") long id);

    int insert(ValueReport row);

    int update(ValueReport row);

    int softDelete(@Param("id") long id, @Param("updatedBy") String updatedBy);

    long countEfficiencyGain(@Param("yearPrefix") String yearPrefix);

    long countQualityGain(@Param("yearPrefix") String yearPrefix);

    List<Map<String, Object>> sumCostSavingByUnit(@Param("yearPrefix") String yearPrefix);
}
