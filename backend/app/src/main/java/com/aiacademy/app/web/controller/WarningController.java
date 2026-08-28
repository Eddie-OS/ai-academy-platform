package com.aiacademy.app.web.controller;

import com.aiacademy.aggregate.warning.domain.WarningDetailItem;
import com.aiacademy.aggregate.warning.domain.WarningSummary;
import com.aiacademy.aggregate.warning.service.WarningLightService;
import com.aiacademy.common.api.R;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 三色灯汇总与预警明细（需求 7.5）。健康对象数不可下钻。
 */
@RestController
@RequestMapping("/api/warnings")
public class WarningController {

    private final WarningLightService warnings;
    private final EmployeeService employees;

    public WarningController(WarningLightService warnings, EmployeeService employees) {
        this.warnings = warnings;
        this.employees = employees;
    }

    @GetMapping("/summary")
    public R<WarningSummary> summary() {
        return R.ok(warnings.summarize());
    }

    @GetMapping
    public R<List<WarningDetailItem>> list(
            @RequestParam(required = false) String light,
            @RequestParam(defaultValue = "50") int limit) {
        int capped = Math.min(Math.max(limit, 1), 200);
        List<WarningDetailItem> raw = warnings.listDetails(light, capped);
        Set<String> nos = raw.stream()
                .map(WarningDetailItem::ownerNo)
                .filter(Objects::nonNull)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
        Map<String, Employee> map = nos.isEmpty() ? Map.of() : employees.findByNos(nos);
        List<WarningDetailItem> out = new ArrayList<>(raw.size());
        for (WarningDetailItem item : raw) {
            String name = item.ownerNo() == null ? null
                    : map.containsKey(item.ownerNo())
                    ? map.get(item.ownerNo()).getEmployeeName()
                    : item.ownerNo();
            out.add(new WarningDetailItem(
                    item.objectType(), item.objectId(), item.objectName(), item.currentState(),
                    item.ownerNo(), name, item.expectFinishDate(), item.lastStateChangedAt(),
                    item.light(), item.lightDays(), item.lightReason()));
        }
        return R.ok(out);
    }
}
