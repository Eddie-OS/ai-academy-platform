package com.aiacademy.app.application.effect;

import com.aiacademy.business.demand.service.DemandReviewService;
import com.aiacademy.platform.statemachine.domain.Effect;
import org.springframework.stereotype.Component;

/**
 * 需求开发状态的三个自动字段（需求 8.3.3 第 25～27 项）：首次上线时间、最新上线时间、优化次数。
 *
 * <p>「首次」的判断在 SQL 的 {@code COALESCE(first_online_date, ?)} 里，不在这里：需求可以从
 * 「已上线」反复回到「优化中」（议题 2 不设上限），每次优化上线都会再次触发本效果，而规则 E1
 * 规定效率指标取<b>首次</b>到达的时间——重算会把需求处理周期变成「最后一次上线用了多久」，
 * 而这个数只会随着优化次数增多越来越大，看上去像是团队越干越慢。
 */
@Component
public class DemandOnlineEffectHandler implements EffectHandler {

    private final DemandReviewService demands;

    public DemandOnlineEffectHandler(DemandReviewService demands) {
        this.demands = demands;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.SET_ONLINE_DATES.equals(effectCode)
                || Effect.INCREMENT_OPTIMIZE_COUNT.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (Effect.SET_ONLINE_DATES.equals(effectCode)) {
            demands.markOnline(context.objectId());
            return;
        }
        demands.incrementOptimizeCount(context.objectId());
    }
}
