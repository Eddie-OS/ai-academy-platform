package com.aiacademy.business.demand.service;

import com.aiacademy.business.demand.domain.Demand;
import com.aiacademy.business.demand.domain.DemandEnums;
import com.aiacademy.business.demand.domain.DemandReview;
import com.aiacademy.business.demand.domain.DemandReviewForm;
import com.aiacademy.business.demand.domain.DemandReviewInfoForm;
import com.aiacademy.business.demand.repository.DemandMapper;
import com.aiacademy.business.demand.repository.DemandReviewMapper;
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
 * 需求评审记录与分流出口（需求 5.2.1、5.2.2、8.3.2、8.3.3）。
 *
 * <p><b>本类不推进状态。</b>录入结论后「评审中 → 已评审」这一跳由 app 层在同一事务内执行，
 * 那一跳的副作用（{@code REQUIRE_OUTLET}）反过来复核出口是否真的落库了。
 */
@Service
public class DemandReviewService {

    private final DemandReviewMapper reviews;
    private final DemandMapper demands;

    public DemandReviewService(DemandReviewMapper reviews, DemandMapper demands) {
        this.reviews = reviews;
        this.demands = demands;
    }

    /**
     * 录入一轮评审结论：写主表当前值 + 建一条历史记录（需求 5.2.1 第 3 行）。
     *
     * <p>先锁行再算轮次：共享账号下两名运营同时录入会算出两个同号轮次，撞在唯一约束上表现为
     * 一次没有解释的失败。
     *
     * @return 新建的评审记录主键
     */
    @Transactional
    public long recordConclusion(long demandId, DemandReviewForm form) {
        return recordConclusion(demandId, form, null, null);
    }

    /**
     * 录入一轮评审结论，并同时写下评审备注与开发优先级。
     *
     * <p>历史行只 INSERT，不改旧轮次。
     */
    @Transactional
    public long recordConclusion(long demandId, DemandReviewForm form,
                                 String reviewRemark, String priority) {
        if (demands.lockById(demandId) == null) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
        if (!DemandEnums.OUTLETS.contains(form.outlet())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "分流出口只能是：%s".formatted(String.join(" / ", DemandEnums.OUTLETS)));
        }

        Demand current = require(demandId);
        int version = form.version() == null ? current.getVersion() : form.version();
        if (demands.recordReviewConclusion(demandId, form.reviewDate(), form.reviewConclusion(),
                form.reviewOpinion(), blankToNull(reviewRemark), blankToNull(priority),
                form.outlet(), operator(), version) == 0) {
            throw concurrentModified(current);
        }

        return reviews.insert(demandId, reviews.nextRoundNo(demandId), form.reviewDate(),
                form.reviewConclusion(), form.reviewOpinion(), blankToNull(reviewRemark), operator());
    }

    /**
     * 只改主表当前评审快照，不写历史、不推进状态。
     *
     * @param writeOutlet 为真时同步分流出口（结论三值已映射）
     */
    @Transactional
    public void updateSnapshot(long demandId, DemandReviewInfoForm form, String outlet,
                               boolean writeOutlet, Integer expectedVersion) {
        if (demands.lockById(demandId) == null) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
        Demand current = require(demandId);
        if (demands.updateReviewSnapshot(demandId, form.reviewConclusion(), form.reviewOpinion(),
                blankToNull(form.reviewRemark()), blankToNull(form.priority()),
                outlet, writeOutlet, operator(), expectedVersion) == 0) {
            if (expectedVersion != null) {
                throw concurrentModified(current);
            }
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * 重新评审时清空分流出口（需求 5.2.1 第 5 条的副作用）。
     *
     * <p>由 {@code CONFIRM_CLEAR_OUTLET} 副作用处理器调用。「需二次确认」是前端的事——后端这里
     * 只做清空，把确认放到后端就要多一个「已确认」的入参，而它除了被前端恒填 true 之外没有别的
     * 取值。
     */
    @Transactional
    public void clearOutlet(long demandId) {
        if (demands.clearOutlet(demandId, operator()) == 0) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
    }

    /** 「输出解决方案」时录入方案名称（需求 8.3.3 第 22 项）。 */
    @Transactional
    public void writeSolutionName(long demandId, String solutionName) {
        if (demands.updateSolutionName(demandId, solutionName, operator()) == 0) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
    }

    /**
     * 进入「已上线」时写上线时间（需求 8.3.3 第 25／26 项）。
     *
     * <p>由 {@code SET_ONLINE_DATES} 副作用处理器调用。首次与最新的区别在 SQL 的 COALESCE 里，
     * 不在这里：优化上线会再次触发本方法，而首次上线时间只写一次。
     */
    @Transactional
    public void markOnline(long demandId) {
        if (demands.markOnline(demandId, LocalDate.now(), operator()) == 0) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
    }

    /** 进入「优化中」时优化次数 +1（需求 8.3.3 第 27 项）。 */
    @Transactional
    public void incrementOptimizeCount(long demandId) {
        if (demands.incrementOptimizeCount(demandId, operator()) == 0) {
            throw new NotFoundException("需求不存在或已删除：" + demandId);
        }
    }

    @Transactional(readOnly = true)
    public List<DemandReview> listByDemand(long demandId) {
        return reviews.findByDemand(demandId);
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
