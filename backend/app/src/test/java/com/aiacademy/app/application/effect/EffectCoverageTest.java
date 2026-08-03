package com.aiacademy.app.application.effect;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 副作用码的覆盖对账。
 *
 * <p>针对本项目最贵的一类缺陷：需求转换表的「系统副作用」列有 20 多项，分四段实现，
 * <b>漏掉一项不报错也没人发现</b>——表现只是「归档成功了但归档时间是空的」，等到按这个字段
 * 统计时才暴露，那时已经积累了一批错数据。
 *
 * <p>因此每个副作用码只有两种合法状态：有处理器，或在 {@link EffectDispatcher#DEFERRED} 里
 * 登记了归属阶段。两者都没有就让测试红——这比在运行时抛异常早得多。
 */
class EffectCoverageTest extends IntegrationTest {

    @Autowired
    private List<EffectHandler> handlers;

    @Autowired
    private StateMachineRegistry registry;

    @Test
    @DisplayName("开发 5.1.5：Effect 里的每个码要么已实现，要么登记了归属阶段")
    void 全部副作用码有归属() {
        List<String> orphans = allEffectCodes().stream()
                .filter(code -> !handled(code) && !deferred(code))
                .toList();

        assertThat(orphans)
                .describedAs("新增副作用码时必须二选一：现在实现，或登记到 EffectDispatcher.DEFERRED 的某一段")
                .isEmpty();
    }

    @Test
    @DisplayName("16 张转换表里出现的副作用码，必须都在 Effect 常量里有定义")
    void 转换表用到的码都有定义() {
        Set<String> declared = allEffectCodes();

        List<String> undeclared = registry.allMachines().stream()
                .map(StateMachineDef::transitions)
                .flatMap(List::stream)
                .map(Transition::effects)
                .flatMap(List::stream)
                .map(EffectCoverageTest::normalize)
                .distinct()
                .filter(code -> !declared.contains(code))
                .toList();

        assertThat(undeclared)
                .describedAs("手写字符串绕过 Effect 常量的副作用码，不会被覆盖对账看到")
                .isEmpty();
    }

    /**
     * {@link Effect} 里声明的全部码值，含两个带参数的前缀。
     *
     * <p>带参数的码（{@code DERIVE_TASK:课程评审}）取值无穷，对账按前缀做——这与
     * {@code EffectDispatcher} 的查表方式一致。
     */
    private static Set<String> allEffectCodes() {
        Set<String> codes = new LinkedHashSet<>();
        codes.add(normalize(Effect.deriveTask("")));
        codes.add(normalize(Effect.setSubState("", "")));
        for (Field field : Effect.class.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) && field.getType() == String.class) {
                try {
                    codes.add((String) field.get(null));
                } catch (IllegalAccessException e) {
                    throw new IllegalStateException("读不到 Effect." + field.getName(), e);
                }
            }
        }
        return codes;
    }

    /** 带参数的码归一到前缀形式，好与 {@link #allEffectCodes()} 对齐。 */
    private static String normalize(String code) {
        int colon = code.indexOf(':');
        return colon < 0 ? code : code.substring(0, colon + 1);
    }

    private boolean handled(String code) {
        return handlers.stream().anyMatch(handler -> handler.supports(code));
    }

    private boolean deferred(String code) {
        return EffectDispatcher.DEFERRED.containsKey(code);
    }

    /** 覆盖对账之外顺带的自检：登记表里不该留着已经实现了的码。 */
    @Test
    @DisplayName("已经实现的副作用码要从 DEFERRED 里移走，否则登记表会越读越不可信")
    void 登记表没有已实现的码() {
        List<String> stale = new ArrayList<>(EffectDispatcher.DEFERRED.keySet()).stream()
                .filter(this::handled)
                .toList();

        assertThat(stale).isEmpty();
    }
}
