package com.aiacademy.business.demand.service;

import com.aiacademy.business.demand.domain.Demand;
import com.aiacademy.business.demand.domain.DemandAcceptance;
import com.aiacademy.business.demand.domain.DemandAcceptanceForm;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.repository.DemandAcceptanceMapper;
import com.aiacademy.business.demand.repository.DemandMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.common.time.DisplayTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 交付、业务验收与归档的<b>字段侧</b>写入（需求 5.2.5、8.3.4）。
 *
 * <p><b>本类不推进状态。</b>四条转换（标记交付使用 / 录入验收结论通过、不通过 / 重新提交验收）
 * 与归档都由 app 层在同一事务内经状态机引擎执行，本类只负责它们的副作用要写的那些列与
 * 验收记录表。这样分是因为平台的状态机模块不得被业务模块反向依赖（AR-2），而状态列的唯一
 * 写入者必须是引擎（开发 5.1.4）。
 */
@Service
public class DemandAcceptanceService {

    private final DemandAcceptanceMapper acceptances;
    private final DemandMapper demands;

    public DemandAcceptanceService(DemandAcceptanceMapper acceptances, DemandMapper demands) {
        this.acceptances = acceptances;
        this.demands = demands;
    }

    /**
     * 录入一轮验收结论：写主表的最新一轮字段 + 建一条历史记录（需求 5.2.5 第 2、3 行）。
     *
     * <p>先锁行再算轮次，理由同评审记录：共享账号下两名运营同时录入会算出两个同号轮次，
     * 撞在唯一约束上表现为一次没有解释的失败。
     *
     * @return 新建的验收记录主键
     */
    @Transactional
    public long recordConclusion(long demandId, DemandAcceptanceForm form) {
        if (demands.lockById(demandId) == null) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
        if (!DemandEnums.ACCEPTANCE_RESULTS.contains(form.acceptanceResult())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "验收结论只能是：%s".formatted(String.join(" / ", DemandEnums.ACCEPTANCE_RESULTS)));
        }

        Demand current = require(demandId);
        int version = form.version() == null ? current.getVersion() : form.version();
        if (demands.recordAcceptance(demandId, form.acceptorName().trim(), form.acceptedAt(),
                form.acceptanceOpinion(), operator(), version) == 0) {
            throw concurrentModified(current);
        }

        return acceptances.insert(demandId, acceptances.nextRoundNo(demandId),
                form.acceptorName().trim(), form.acceptedAt(), form.acceptanceResult(),
                form.acceptanceOpinion(), operator());
    }

    /**
     * 标记交付使用时写交付时间（需求 5.2.5 第 1 行）。由 {@code SET_DELIVERED_AT} 副作用调用。
     *
     * <p>同一次点击会触发两次（业务验收状态与需求交付标记是两个状态机），SQL 侧用 COALESCE
     * 保证只写一次。
     */
    @Transactional
    public void markDelivered(long demandId) {
        if (demands.markDelivered(demandId, LocalDate.now(), operator()) == 0) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
    }

    /** 重新提交验收时轮次 +1（需求 8.3.4 第 34 项）。由 {@code INCREMENT_ACCEPTANCE_ROUND} 调用。 */
    @Transactional
    public void incrementRound(long demandId) {
        if (demands.incrementAcceptanceRound(demandId, operator()) == 0) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
    }

    /** 归档时写归档时间。由 {@code SET_ARCHIVED_AT} 副作用调用。 */
    @Transactional
    public void markArchived(long demandId) {
        if (demands.markArchived(demandId, LocalDate.now(), operator()) == 0) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
    }

    @Transactional(readOnly = true)
    public List<DemandAcceptance> listByDemand(long demandId) {
        return acceptances.findByDemand(demandId);
    }

    private Demand require(long demandId) {
        Demand demand = demands.selectById(demandId);
        if (demand == null) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
        return demand;
    }

    private static BizException concurrentModified(Demand current) {
        return new BizException(ErrorCode.CONCURRENT_MODIFIED,
                "该记录已被他人修改（最后修改：%s），请刷新后重试"
                        .formatted(DisplayTime.human(current.getUpdatedAt())));
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
