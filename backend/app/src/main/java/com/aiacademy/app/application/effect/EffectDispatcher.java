package com.aiacademy.app.application.effect;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

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
 * <p>{@code EffectCoverageTest} 拿 Effect 的全部常量与本表 + 已注册处理器对账，
 * 保证新增副作用码时必须显式决定它归哪一段。
 */
@Component
public class EffectDispatcher {

    private static final Logger log = LoggerFactory.getLogger(EffectDispatcher.class);

    private static final String DERIVE_TASK_PREFIX = "DERIVE_TASK:";

    /**
     * 已排期到后续阶段的副作用码 → 归属说明。
     *
     * <p>阶段 2／3A 已把全部既有副作用码实现完毕；本表目前为空。新增副作用码时必须二选一：
     * 现在实现，或在此登记归属阶段。
     */
    static final Map<String, String> DEFERRED = Map.of();

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
