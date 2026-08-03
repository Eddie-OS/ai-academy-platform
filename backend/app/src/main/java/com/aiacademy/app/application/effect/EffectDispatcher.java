package com.aiacademy.app.application.effect;

import com.aiacademy.platform.statemachine.domain.Effect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把一条转换携带的副作用码派发给对应的 {@link EffectHandler}。
 *
 * <p><b>没有处理器的副作用码不会被静默跳过。</b>{@link #DEFERRED} 逐条登记了「哪个码排在哪一段
 * 实现」，登记过的记一条 INFO，没登记的直接抛异常。这个设计针对的是本项目最贵的一类缺陷：
 * 需求转换表的副作用列有 20 多项，分散在四段会话里实现，漏掉一项<b>不会报错也不会有人发现</b>——
 * 表现只是「归档成功了但归档时间是空的」「课程发布了但有效期截止日没算」，要等到按这个字段
 * 统计时才暴露，那时已经积累了一批错数据。
 *
 * <p>{@code EffectCoverageTest} 拿 {@link Effect} 的全部常量与本表 + 已注册处理器对账，
 * 保证新增副作用码时必须显式决定它归哪一段。
 */
@Component
public class EffectDispatcher {

    private static final Logger log = LoggerFactory.getLogger(EffectDispatcher.class);

    private static final String DERIVE_TASK_PREFIX = "DERIVE_TASK:";

    /**
     * 已排期到后续阶段的副作用码 → 归属说明。
     *
     * <p>阶段 2 分四段（A 课程 / B 需求 / C 培训 / D 讲师+案例），每段实现自己那几项时
     * 从本表移走。任务相关的两项属于阶段 3 的 {@code aggregate/worklist}。
     */
    static final Map<String, String> DEFERRED = deferred();

    private static Map<String, String> deferred() {
        Map<String, String> map = new LinkedHashMap<>();

        // 课程侧的五项已实现：SNAPSHOT_MATERIAL、CREATE_REVIEW_ROUND、SET_ROUND_NO、
        // BIND_MATERIAL_VERSION、DRIVE_COURSE_MAIN_STATE（A-3 评审记录，A-4 补齐试讲记录分支）

        // 需求侧十项已全部实现：REQUIRE_OUTLET、CONFIRM_CLEAR_OUTLET（B-2 分流出口），
        // SET_ONLINE_DATES、INCREMENT_OPTIMIZE_COUNT（B-2 开发状态的三个自动字段），
        // SET_DELIVERED_AT、RECORD_ACCEPTANCE、REVERT_BY_OUTLET、INCREMENT_ACCEPTANCE_ROUND、
        // REQUIRE_ACCEPTANCE_PASSED、SET_ARCHIVED_AT（B-3 交付、业务验收与归档）

        // 培训侧三项已全部实现：SET_ACTUAL_FINISHED_AT（C-1 培训计划），
        // ATTACH_TO_PLAN、VALIDATE_SCHEDULING（C-2 培训场次与排课校验）

        // 讲师侧一项已实现：UPDATE_LECTURER_TRIAL_FLAG（D-1 试讲合格标记）

        // 案例侧三项已全部实现：CREATE_CASE（D-3 课程达精品自动建案例）、
        // RECORD_CASE_AUDIT、SET_CASE_PUBLISHED_AT（D-3 案例审核）

        // 任务派生与自动关闭都要读 cfg_task_derive_rule 并写 sys_task，那是 worklist 的职责
        map.put(Effect.CLOSE_RELATED_TASKS, "阶段 3（任务中心）");
        map.put(DERIVE_TASK_PREFIX, "阶段 3（任务中心）");

        return Map.copyOf(map);
    }

    private final List<EffectHandler> handlers;

    public EffectDispatcher(List<EffectHandler> handlers) {
        this.handlers = List.copyOf(handlers);
    }

    public void dispatch(EffectContext context) {
        for (String effectCode : context.transition().effects()) {
            apply(context, effectCode);
        }
    }

    private void apply(EffectContext context, String effectCode) {
        for (EffectHandler handler : handlers) {
            if (handler.supports(effectCode)) {
                handler.handle(context, effectCode);
                return;
            }
        }

        String stage = deferredStageOf(effectCode);
        if (stage == null) {
            throw new IllegalStateException(("副作用码「%s」既没有处理器，也没有在 EffectDispatcher.DEFERRED "
                    + "里登记归属阶段。新增副作用码时必须二选一：现在实现，或登记到某一段。"
                    + "触发它的是 %s#%d 的「%s」").formatted(effectCode, context.objectType(),
                    context.objectId(), context.transition().actionLabel()));
        }
        log.info("副作用 {} 归属{}，本阶段不执行。触发对象 {}#{}，动作「{}」",
                effectCode, stage, context.objectType(), context.objectId(),
                context.transition().actionLabel());
    }

    /** 带参数的码（{@code DERIVE_TASK:课程评审}）按前缀查表。 */
    private static String deferredStageOf(String effectCode) {
        if (effectCode.startsWith(DERIVE_TASK_PREFIX)) {
            return DEFERRED.get(DERIVE_TASK_PREFIX);
        }
        return DEFERRED.get(effectCode);
    }
}
