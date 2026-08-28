package com.aiacademy.app.web.dto;

import java.util.List;

/**
 * 待催办清单：按负责人分组（需求 13.5.2／13.5.3、开发 5.8.2）。
 */
public record EscalationPendingVO(
        String cycleStart,
        Summary summary,
        List<OwnerGroup> groups
) {
    public record Summary(long pendingCount, long urgedThisCycle, long redUnurgedOver7Days) {
    }

    public record OwnerGroup(
            String ownerNo,
            String ownerName,
            DimensionCounts dimensions,
            List<PendingItem> items
    ) {
    }

    public record DimensionCounts(
            TaskDim tasks,
            DemandDim demands,
            CourseDim courses,
            TrainingDim trainings,
            CaseDim cases
    ) {
    }

    public record TaskDim(long openCount, long overdueCount) {
    }

    public record DemandDim(long blue, long yellow, long red, long pendingAcceptance) {
    }

    public record CourseDim(long pendingReview, long pendingTrial, long pendingOptimize, long validitySoon30d) {
    }

    public record TrainingDim(long pendingStart, long pendingAttendance, long pendingArchive) {
    }

    public record CaseDim(long pendingOrganize, long organizing, long pendingAudit) {
    }

    public record PendingItem(
            String objectType,
            long objectId,
            String objectName,
            String currentState,
            String light,
            Integer lightDays,
            String lightReason,
            String escalateType,
            String defaultContent,
            boolean urgedThisCycle,
            String urgedLabel,
            boolean lightChanged
    ) {
    }
}
