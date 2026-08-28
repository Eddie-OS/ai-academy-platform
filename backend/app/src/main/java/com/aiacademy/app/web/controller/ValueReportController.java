package com.aiacademy.app.web.controller;

import com.aiacademy.business.demand.domain.ValueReport;
import com.aiacademy.business.demand.domain.ValueReportForm;
import com.aiacademy.business.demand.domain.ValueYearSummary;
import com.aiacademy.business.demand.service.ValueReportService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 业务价值人工填报（需求 7.8、15.6）。
 */
@RestController
@RequestMapping("/api/value-reports")
public class ValueReportController {

    private final ValueReportService values;

    public ValueReportController(ValueReportService values) {
        this.values = values;
    }

    @GetMapping
    public R<List<ValueReport>> list(@RequestParam(required = false) Integer year) {
        return R.ok(values.listYear(year));
    }

    @GetMapping("/summary")
    public R<ValueYearSummary> summary(@RequestParam(required = false) Integer year) {
        return R.ok(values.yearSummary(year));
    }

    @GetMapping("/{id}")
    public R<ValueReport> detail(@PathVariable long id) {
        return R.ok(values.require(id));
    }

    @WriteApi
    @PostMapping
    public R<ValueReport> create(@Valid @RequestBody ValueReportForm form) {
        return R.ok(values.create(form));
    }

    @WriteApi
    @PutMapping("/{id}")
    public R<ValueReport> update(@PathVariable long id, @Valid @RequestBody ValueReportForm form) {
        return R.ok(values.update(id, form));
    }

    @WriteApi
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable long id) {
        values.delete(id);
        return R.ok(null);
    }
}
