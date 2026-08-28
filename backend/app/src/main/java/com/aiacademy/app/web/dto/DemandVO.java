package com.aiacademy.app.web.dto;

import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.domain.DemandListItem;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 需求列表行与详情的出参（需求 8.6 的默认展示列 + 可选列）。
 *
 * <p>灯色三字段由 app 层按 {@code WarningLightService} 实时装配（阶段 3B）。
 *
 * <p><b>交付使用标记与归档标记不作为两个布尔下发。</b>它们是 {@code deliveryMark} 一列的两种
 * 取值（需求 5.13 第 5 项把两者归为一个状态机），前端按状态机下发的取值渲染即可——拆成两个
 * 布尔就得在前端维护「哪个取值算已交付」的映射，那正是纪律 STK-1 要杜绝的。
 *
 * @param currentProcessState 当前处理状态：出口一取解决方案状态（空则「待输出」），出口二取需求开发状态，出口三固定「结束」
 * @param light               灯色 API 码 BLUE／YELLOW／RED／NONE
 * @param lightDays           与灯色配套的天数；无灯时为 null
 * @param lightReason         红灯原因文案；非红灯为 null
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
        String ownerNames,
        String businessBackground,
        String roiAnalysis,
        String remark,
        String reviewState,
        LocalDate reviewDate,
        String reviewConclusion,
        String reviewOpinion,
        String reviewRemark,
        String outlet,
        String solutionState,
        String solutionName,
        String solutionRemark,
        String devName,
        String devState,
        String devRemark,
        String currentProcessState,
        LocalDate firstOnlineDate,
        LocalDate latestOnlineDate,
        Integer optimizeCount,
        String deliveryMark,
        String deliveryRemark,
        LocalDate deliveredAt,
        LocalDate actualFinishDate,
        String solutionLink,
        String courseLink,
        LocalDate archivedAt,
        String acceptanceState,
        String acceptorName,
        LocalDate acceptedAt,
        String acceptanceOpinion,
        String acceptanceRemark,
        Integer acceptanceRound,
        Integer courseCount,
        Boolean hasCourse,
        OffsetDateTime lastStateChangedAt,
        OffsetDateTime updatedAt,
        String updatedBy,
        Integer version,
        String light,
        Integer lightDays,
        String lightReason) {

    public static DemandVO of(DemandListItem d, WarningLightView light) {
        WarningLightView resolved = DemandEnums.OUTLET_REJECT.equals(d.getOutlet())
                ? WarningLightView.none(DemandStateMachines.OBJECT_TYPE, d.getId())
                : light;
        return new DemandVO(
                d.getId(), d.getDemandNo(), d.getDemandName(), d.getDomainCode(),
                d.getProposerNo(), d.getProposerName(), d.getProposerDept(),
                d.getOwnerNo(), d.getOwnerName(), d.getProposedDate(), d.getExpectFinishDate(),
                d.getDescription(), d.getDemandSource(), d.getDemandType(), d.getPriority(),
                d.getOwnerNames(), d.getBusinessBackground(), d.getRoiAnalysis(), d.getRemark(),
                d.getReviewState(), d.getReviewDate(), d.getReviewConclusion(), d.getReviewOpinion(),
                d.getReviewRemark(),
                d.getOutlet(), d.getSolutionState(), d.getSolutionName(), d.getSolutionRemark(),
                d.getDevName(), d.getDevState(), d.getDevRemark(),
                d.getCurrentProcessState(), d.getFirstOnlineDate(), d.getLatestOnlineDate(),
                d.getOptimizeCount(), d.getDeliveryMark(), d.getDeliveryRemark(),
                d.getDeliveredAt(), d.getActualFinishDate(), d.getSolutionLink(), d.getCourseLink(),
                d.getArchivedAt(),
                d.getAcceptanceState(), d.getAcceptorName(), d.getAcceptedAt(),
                d.getAcceptanceOpinion(), d.getAcceptanceRemark(), d.getAcceptanceRound(),
                d.getCourseCount(), d.getHasCourse(),
                d.getLastStateChangedAt(), d.getUpdatedAt(), d.getUpdatedBy(), d.getVersion(),
                resolved.light(), resolved.days(), resolved.reason());
    }
}
