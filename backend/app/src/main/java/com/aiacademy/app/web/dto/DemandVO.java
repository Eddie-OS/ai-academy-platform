package com.aiacademy.app.web.dto;

import com.aiacademy.business.demand.domain.DemandListItem;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 需求列表行与详情的出参（需求 8.6 的默认展示列 + 可选列）。
 *
 * <p><b>灯色字段暂缺。</b>三色灯的计算属于阶段 3 的 {@code aggregate/warning}，那时会按 13.4.1a
 * 的阈值统一算出灯色、天数与文案。列表页此刻留出这一列的位置但不填值。
 *
 * <p><b>交付使用标记与归档标记不作为两个布尔下发。</b>它们是 {@code deliveryMark} 一列的两种
 * 取值（需求 5.13 第 5 项把两者归为一个状态机），前端按状态机下发的取值渲染即可——拆成两个
 * 布尔就得在前端维护「哪个取值算已交付」的映射，那正是纪律 STK-1 要杜绝的。
 *
 * @param currentProcessState 当前处理状态：出口一取解决方案状态，出口二取需求开发状态（需求 8.6）
 * @param version             乐观锁版本号（规则 K1）。编辑与状态转换都要带回来
 */
public record DemandVO(
        Long id,
        String demandNo,
        String demandName,
        String domainCode,
        String proposerNo,
        String proposerName,
        String proposerDept,
        String ownerNo,
        String ownerName,
        LocalDate proposedDate,
        LocalDate expectFinishDate,
        String description,
        String demandSource,
        String demandType,
        String priority,
        String reviewState,
        LocalDate reviewDate,
        String reviewConclusion,
        String reviewOpinion,
        String outlet,
        String solutionState,
        String solutionName,
        String devState,
        String currentProcessState,
        LocalDate firstOnlineDate,
        LocalDate latestOnlineDate,
        Integer optimizeCount,
        String deliveryMark,
        LocalDate deliveredAt,
        LocalDate archivedAt,
        String acceptanceState,
        String acceptorName,
        LocalDate acceptedAt,
        String acceptanceOpinion,
        Integer acceptanceRound,
        Integer courseCount,
        Boolean hasCourse,
        OffsetDateTime lastStateChangedAt,
        OffsetDateTime updatedAt,
        String updatedBy,
        Integer version) {

    public static DemandVO of(DemandListItem d) {
        return new DemandVO(
                d.getId(), d.getDemandNo(), d.getDemandName(), d.getDomainCode(),
                d.getProposerNo(), d.getProposerName(), d.getProposerDept(),
                d.getOwnerNo(), d.getOwnerName(), d.getProposedDate(), d.getExpectFinishDate(),
                d.getDescription(), d.getDemandSource(), d.getDemandType(), d.getPriority(),
                d.getReviewState(), d.getReviewDate(), d.getReviewConclusion(), d.getReviewOpinion(),
                d.getOutlet(), d.getSolutionState(), d.getSolutionName(), d.getDevState(),
                d.getCurrentProcessState(), d.getFirstOnlineDate(), d.getLatestOnlineDate(),
                d.getOptimizeCount(), d.getDeliveryMark(), d.getDeliveredAt(), d.getArchivedAt(),
                d.getAcceptanceState(), d.getAcceptorName(), d.getAcceptedAt(),
                d.getAcceptanceOpinion(), d.getAcceptanceRound(), d.getCourseCount(), d.getHasCourse(),
                d.getLastStateChangedAt(), d.getUpdatedAt(), d.getUpdatedBy(), d.getVersion());
    }
}
