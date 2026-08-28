package com.aiacademy.business.demand.service;

import com.aiacademy.business.demand.domain.ValueReport;
import com.aiacademy.business.demand.domain.ValueReportForm;
import com.aiacademy.business.demand.domain.ValueYearSummary;
import com.aiacademy.business.demand.repository.ValueReportMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 业务价值人工填报（需求 7.8、15.6）。一期不做自动回收（N14）。
 */
@Service
public class ValueReportService {

    private final ValueReportMapper mapper;

    public ValueReportService(ValueReportMapper mapper) {
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<ValueReport> listYear(Integer year) {
        int y = year == null ? LocalDate.now().getYear() : year;
        return mapper.selectByYearPrefix(String.valueOf(y));
    }

    @Transactional(readOnly = true)
    public ValueReport require(long id) {
        ValueReport row = mapper.findById(id);
        if (row == null) {
            throw new NotFoundException("业务价值填报不存在");
        }
        return row;
    }

    @Transactional(readOnly = true)
    public ValueYearSummary yearSummary(Integer year) {
        int y = year == null ? LocalDate.now().getYear() : year;
        String prefix = String.valueOf(y);
        Map<String, BigDecimal> byUnit = new LinkedHashMap<>();
        for (Map<String, Object> row : mapper.sumCostSavingByUnit(prefix)) {
            Object unit = row.get("unit");
            if (unit == null) {
                unit = row.get("UNIT");
            }
            Object total = row.get("total");
            if (total == null) {
                total = row.get("TOTAL");
            }
            if (unit != null && total instanceof Number n) {
                byUnit.put(unit.toString(), BigDecimal.valueOf(n.doubleValue()));
            }
        }
        return new ValueYearSummary(
                y,
                mapper.countEfficiencyGain(prefix),
                mapper.countQualityGain(prefix),
                Map.copyOf(byUnit));
    }

    @Transactional
    public ValueReport create(ValueReportForm form) {
        validateUnit(form);
        ValueReport row = fromForm(form);
        row.setCreatedBy(operator());
        mapper.insert(row);
        return require(row.getId());
    }

    @Transactional
    public ValueReport update(long id, ValueReportForm form) {
        validateUnit(form);
        ValueReport existing = require(id);
        existing.setReportPeriod(form.getReportPeriod());
        existing.setEfficiencyGain(blankToNull(form.getEfficiencyGain()));
        existing.setQualityGain(blankToNull(form.getQualityGain()));
        existing.setCostSaving(form.getCostSaving());
        existing.setCostSavingUnit(form.getCostSavingUnit());
        existing.setDemandIds(form.getDemandIds());
        existing.setCaseIds(form.getCaseIds());
        existing.setDescription(blankToNull(form.getDescription()));
        existing.setUpdatedBy(operator());
        mapper.update(existing);
        return require(id);
    }

    @Transactional
    public void delete(long id) {
        require(id);
        int n = mapper.softDelete(id, operator());
        if (n == 0) {
            throw new NotFoundException("业务价值填报不存在");
        }
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }

    private static void validateUnit(ValueReportForm form) {
        String unit = form.getCostSavingUnit();
        if (unit != null && !unit.isBlank() && !"万元".equals(unit) && !"人天".equals(unit)) {
            throw new BizException(ErrorCode.PARAM_INVALID, "成本节约单位须为万元或人天");
        }
        if (form.getCostSaving() != null && (unit == null || unit.isBlank())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "填写成本节约值时必须选择单位");
        }
        if (unit != null && !unit.isBlank() && form.getCostSaving() == null) {
            throw new BizException(ErrorCode.PARAM_INVALID, "选择单位时必须填写成本节约值");
        }
    }

    private static ValueReport fromForm(ValueReportForm form) {
        ValueReport row = new ValueReport();
        row.setReportPeriod(form.getReportPeriod());
        row.setEfficiencyGain(blankToNull(form.getEfficiencyGain()));
        row.setQualityGain(blankToNull(form.getQualityGain()));
        row.setCostSaving(form.getCostSaving());
        row.setCostSavingUnit(form.getCostSavingUnit());
        row.setDemandIds(form.getDemandIds());
        row.setCaseIds(form.getCaseIds());
        row.setDescription(blankToNull(form.getDescription()));
        return row;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
