package com.aiacademy.app.application.effect;

import com.aiacademy.business.kase.domain.CaseInfo;
import com.aiacademy.business.kase.service.CaseService;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import org.springframework.stereotype.Component;

/**
 * 案例审核的两个副作用（需求 5.9 后两行）：复核审核字段、审核通过时写上架时间。
 *
 * <p>{@code RECORD_CASE_AUDIT} 是<b>复核</b>而不是补写，理由同 {@code DemandAcceptanceEffectHandler}：
 * 审核人、审核时间与结论随状态一起落库（见 {@code CaseApplicationService.recordAudit}），这里读
 * 回来确认它真的在。有人日后绕过审核结论接口、直接调统一转换接口把案例推到「已上架」时，
 * 这里当场拒绝——否则会出现一条谁也说不清是谁批的已上架案例，而 C9 把「上架前必须审核通过」
 * 列为三处硬阻断之一。
 *
 * <p><b>硬阻断只有这一层。</b>「整理中不能直接跳到已上架」那一半不需要代码：转换表里就没有
 * 「整理中 → 已上架」这一行，C3 的默认拒绝已经实现了它。
 *
 * <p>{@code SET_CASE_PUBLISHED_AT} 写的是<b>首次</b>上架时间，只写一次（COALESCE 在 SQL 侧）：
 * 案例可以「下架修改 → 再审核通过」反复上架，而上架时间是 15.5 案例上架周期的终点，重算会让
 * 指标变成「最后一次上架用了多久」。
 */
@Component
public class CaseAuditEffectHandler implements EffectHandler {

    private final CaseService cases;

    public CaseAuditEffectHandler(CaseService cases) {
        this.cases = cases;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.RECORD_CASE_AUDIT.equals(effectCode)
                || Effect.SET_CASE_PUBLISHED_AT.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        requireCaseObject(context);
        if (Effect.RECORD_CASE_AUDIT.equals(effectCode)) {
            requireAuditRecorded(context);
            return;
        }
        cases.markPublished(context.objectId());
    }

    private void requireAuditRecorded(EffectContext context) {
        CaseInfo caseInfo = cases.require(context.objectId());
        if (caseInfo.getReviewerNo() == null || caseInfo.getReviewedAt() == null
                || caseInfo.getReviewResult() == null) {
            throw new IllegalStateException(("案例 %d 推进到审核结论时没有审核人、审核时间或审核结论。"
                    + "审核结论必须走 POST /api/cases/{id}/audit 录入，"
                    + "它会在同一事务里写字段再转状态").formatted(context.objectId()));
        }
    }

    private static void requireCaseObject(EffectContext context) {
        if (!CaseStateMachines.OBJECT_TYPE.equals(context.objectType())) {
            throw new IllegalStateException("案例审核副作用只用于案例，收到 " + context.objectType());
        }
    }
}
