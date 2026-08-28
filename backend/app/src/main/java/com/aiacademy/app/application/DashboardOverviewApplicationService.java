package com.aiacademy.app.application;

import com.aiacademy.aggregate.metrics.domain.EfficiencySnapshot;
import com.aiacademy.aggregate.metrics.domain.EfficiencyTrendsVO;
import com.aiacademy.aggregate.metrics.service.EfficiencyMetricsService;
import com.aiacademy.aggregate.metrics.service.QuantityMetricsService;
import com.aiacademy.aggregate.warning.domain.WarningDetailItem;
import com.aiacademy.aggregate.warning.domain.WarningSummary;
import com.aiacademy.aggregate.warning.service.WarningLightService;
import com.aiacademy.aggregate.worklist.domain.TaskListItem;
import com.aiacademy.aggregate.worklist.domain.TaskQuery;
import com.aiacademy.aggregate.worklist.service.TaskQueryService;
import com.aiacademy.app.web.dto.DashboardOverviewVO;
import com.aiacademy.business.demand.domain.ValueYearSummary;
import com.aiacademy.business.demand.service.ValueReportService;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeService;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * 总看板单接口装配（需求第 7 章、开发 5.5.3）。
 *
 * <p>跨模块编排放 app（AR-4）；互不依赖的聚合查询用固定大小线程池并行（限 CPU 核数，不用 commonPool）。
 */
@Service
public class DashboardOverviewApplicationService {

    private final QuantityMetricsService quantity;
    private final EfficiencyMetricsService efficiency;
    private final WarningLightService warnings;
    private final TaskQueryService tasks;
    private final ValueReportService values;
    private final EmployeeService employees;
    private final ExecutorService pool;

    public DashboardOverviewApplicationService(QuantityMetricsService quantity,
                                               EfficiencyMetricsService efficiency,
                                               WarningLightService warnings,
                                               TaskQueryService tasks,
                                               ValueReportService values,
                                               EmployeeService employees) {
        this.quantity = quantity;
        this.efficiency = efficiency;
        this.warnings = warnings;
        this.tasks = tasks;
        this.values = values;
        this.employees = employees;
        int n = Math.max(2, Runtime.getRuntime().availableProcessors());
        this.pool = Executors.newFixedThreadPool(n, r -> {
            Thread t = new Thread(r, "dashboard-overview");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }

    public DashboardOverviewVO overview() {
        CompletableFuture<Map<String, Long>> qtyFuture = CompletableFuture.supplyAsync(this::quantityKpis, pool);
        CompletableFuture<Map<String, Map<String, Long>>> cockpitsFuture =
                CompletableFuture.supplyAsync(this::cockpitCards, pool);
        CompletableFuture<Map<String, String>> effFuture =
                CompletableFuture.supplyAsync(this::efficiencyCards, pool);
        CompletableFuture<DashboardOverviewVO.EfficiencyTrends> trendFuture =
                CompletableFuture.supplyAsync(this::efficiencyTrends, pool);
        CompletableFuture<WarningSummary> warnFuture =
                CompletableFuture.supplyAsync(warnings::summarize, pool);
        CompletableFuture<List<DashboardOverviewVO.WorklistItem>> workFuture =
                CompletableFuture.supplyAsync(this::worklist, pool);
        CompletableFuture<List<DashboardOverviewVO.TaskItem>> taskFuture =
                CompletableFuture.supplyAsync(this::openTasks, pool);
        CompletableFuture<DashboardOverviewVO.ValueBlock> valueFuture =
                CompletableFuture.supplyAsync(this::valueBlock, pool);

        CompletableFuture.allOf(qtyFuture, cockpitsFuture, effFuture, trendFuture, warnFuture,
                workFuture, taskFuture, valueFuture).join();

        WarningSummary summary = warnFuture.join();
        return new DashboardOverviewVO(
                qtyFuture.join(),
                cockpitsFuture.join(),
                new DashboardOverviewVO.WarningBlock(
                        summary.healthy(), summary.blue(), summary.yellow(), summary.red()),
                workFuture.join(),
                effFuture.join(),
                trendFuture.join(),
                valueFuture.join(),
                taskFuture.join());
    }

    private Map<String, Long> quantityKpis() {
        var snap = quantity.all();
        Map<String, Long> out = new LinkedHashMap<>();
        out.put("demandTotal", snap.asLong("1"));
        out.put("courseTotal", snap.asLong("6"));
        out.put("coursePublished", snap.asLong("8"));
        out.put("lecturerPool", snap.asLong("11"));
        out.put("trainingSession", snap.asLong("15"));
        out.put("caseListed", snap.asLong("18"));
        return out;
    }

    private Map<String, Map<String, Long>> cockpitCards() {
        Map<String, Map<String, Long>> out = new LinkedHashMap<>();
        out.put("demands", quantity.forDemands().values());
        out.put("courses", quantity.forCourses().values());
        out.put("lecturers", quantity.forLecturers().values());
        out.put("trainings", quantity.forTrainings().values());
        out.put("cases", quantity.forCases().values());
        return out;
    }

    private Map<String, String> efficiencyCards() {
        EfficiencySnapshot snap = efficiency.all();
        Map<String, String> out = new LinkedHashMap<>();
        out.put("demandReviewCycle", plain(snap.get("1")));
        out.put("courseDevCycle", plain(snap.get("3")));
        out.put("firstRoundPassRate", plain(snap.get("5")));
        out.put("reviewRounds", plain(snap.get("4")));
        out.put("casePublishCycle", plain(snap.get("8")));
        return out;
    }

    private DashboardOverviewVO.EfficiencyTrends efficiencyTrends() {
        EfficiencyTrendsVO t = efficiency.trendsLast6Months();
        return new DashboardOverviewVO.EfficiencyTrends(t.months(), t.series());
    }

    private List<DashboardOverviewVO.WorklistItem> worklist() {
        List<WarningDetailItem> details = warnings.listDetails(null, 20);
        Map<String, String> names = resolveNames(details.stream()
                .map(WarningDetailItem::ownerNo)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        List<DashboardOverviewVO.WorklistItem> rows = new ArrayList<>();
        for (WarningDetailItem d : details) {
            Integer remaining = remainingDays(d.expectFinishDate());
            rows.add(new DashboardOverviewVO.WorklistItem(
                    d.objectType(), d.objectId(), d.objectName(), d.currentState(),
                    d.ownerNo(), names.getOrDefault(d.ownerNo(), d.ownerNo()),
                    d.expectFinishDate(), remaining, d.light(), d.lightDays(), d.lightReason()));
        }
        return rows;
    }

    private List<DashboardOverviewVO.TaskItem> openTasks() {
        TaskQuery q = new TaskQuery();
        q.setPageNum(1);
        q.setPageSize(20);
        PageResult<TaskListItem> page = tasks.page(q);
        return page.records().stream()
                .map(t -> new DashboardOverviewVO.TaskItem(
                        t.id(), t.title(), t.taskType(), t.objectType(), t.objectId(),
                        t.ownerNo(), t.ownerName(), t.dueDate(), t.taskState(), t.overdue()))
                .toList();
    }

    private DashboardOverviewVO.ValueBlock valueBlock() {
        ValueYearSummary s = values.yearSummary(null);
        Map<String, String> cost = new LinkedHashMap<>();
        s.costSavingByUnit().forEach((unit, amount) -> cost.put(unit, amount.toPlainString()));
        return new DashboardOverviewVO.ValueBlock(
                s.year(), s.efficiencyGainCount(), s.qualityGainCount(), cost);
    }

    private Map<String, String> resolveNames(java.util.Set<String> nos) {
        if (nos.isEmpty()) {
            return Map.of();
        }
        Map<String, String> out = new LinkedHashMap<>();
        for (Map.Entry<String, Employee> e : employees.findByNos(nos).entrySet()) {
            out.put(e.getKey(), e.getValue().getEmployeeName());
        }
        return out;
    }

    private static Integer remainingDays(java.time.LocalDate expect) {
        if (expect == null) {
            return null;
        }
        return (int) (expect.toEpochDay() - java.time.LocalDate.now().toEpochDay());
    }

    private static String plain(BigDecimal v) {
        return v == null ? null : v.toPlainString();
    }
}
