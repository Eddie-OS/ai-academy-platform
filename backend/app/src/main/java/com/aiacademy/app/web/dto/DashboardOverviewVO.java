package com.aiacademy.app.web.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * {@code GET /api/dashboard/overview} 出参（需求第 7 章 A–E + 业务价值 + 任务摘要）。
 */
public record DashboardOverviewVO(
        Map<String, Long> quantity,
        Map<String, Map<String, Long>> cockpits,
        WarningBlock warnings,
        List<WorklistItem> worklist,
        Map<String, String> efficiency,
        /** 近 6 个月趋势（U7）；months 与 series[*] 等长，无样本为 null */
        EfficiencyTrends efficiencyTrends,
        ValueBlock value,
        List<TaskItem> openTasks
) {

    public record EfficiencyTrends(List<String> months, Map<String, List<String>> series) {
    }

    public record WarningBlock(long healthy, long blue, long yellow, long red) {
    }

    public record WorklistItem(
            String objectType,
            long objectId,
            String objectName,
            String currentState,
            String ownerNo,
            String ownerName,
            LocalDate expectFinishDate,
            Integer remainingDays,
            String light,
            Integer lightDays,
            String lightReason
    ) {
    }

    public record ValueBlock(
            int year,
            long efficiencyGainCount,
            long qualityGainCount,
            Map<String, String> costSavingByUnit
    ) {
    }

    public record TaskItem(
            long id,
            String title,
            String taskType,
            String objectType,
            Long objectId,
            String ownerNo,
            String ownerName,
            LocalDate dueDate,
            String taskState,
            boolean overdue
    ) {
    }
}
