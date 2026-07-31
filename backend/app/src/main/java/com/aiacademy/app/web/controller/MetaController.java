package com.aiacademy.app.web.controller;

import com.aiacademy.common.api.R;
import com.aiacademy.platform.dict.domain.DictItem;
import com.aiacademy.platform.dict.service.DictConfigService;
import com.aiacademy.platform.dict.service.DictQuery;
import com.aiacademy.platform.dict.service.SelfcheckConfigService;
import com.aiacademy.platform.dict.service.WarningThresholdService;
import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 枚举与字典下发（《开发实施文档》7.5）。前端<b>不硬编码任何状态值与字典项</b>（纪律 STK-1）。
 *
 * <p>放在 app 层而不是某个平台模块：三个接口分别要状态机注册表（platform/statemachine）与配置表
 * （platform/dict）的数据，跨模块的编排属于应用服务（规则 AR-4）。
 *
 * <p><b>刻意不加缓存。</b>7.5 提到「应用启动后缓存 + 配置中心保存时清缓存」，但那是为了省一次
 * 查询，而这三张表合计不到 100 行、前端登录后只拉一次。加了缓存就要维护失效：阈值改了忘清缓存，
 * 表现是需求 13.9.2「保存后灯色实时重算」（验收点 A3-6）静默失效——为省一次小查询换来一个
 * 不容易发现的缺陷不值得。真到有性能问题时再加，届时缓存与失效一起写。
 */
@RestController
@RequestMapping("/api/meta")
public class MetaController {

    private final StateMachineRegistry registry;
    private final DictConfigService dicts;
    private final SelfcheckConfigService selfchecks;
    private final WarningThresholdService thresholds;

    public MetaController(StateMachineRegistry registry,
                          DictConfigService dicts,
                          SelfcheckConfigService selfchecks,
                          WarningThresholdService thresholds) {
        this.registry = registry;
        this.dicts = dicts;
        this.selfchecks = selfchecks;
        this.thresholds = thresholds;
    }

    /**
     * 一个状态机的对外形态。
     *
     * @param states 该状态字段的全部取值，按转换表出现顺序去重——顺序即业务流程顺序，
     *               前端的状态筛选下拉直接照这个顺序渲染，比按字典序排更贴近业务理解
     * @param terminalStates 终态集合。前端用它决定「已结束」类样式，不再自己列举状态名
     */
    public record MachineMeta(String machineName, String objectType, String stateField,
                             List<String> states, List<String> terminalStates,
                             List<ActionMeta> actions) {
    }

    /** 动作码与中文动作名的对应。前端渲染按钮文案用它，不在前端维护一份翻译表。 */
    public record ActionMeta(String action, String label, String from, String to) {
    }

    @GetMapping("/enums")
    public R<List<MachineMeta>> enums() {
        return R.ok(registry.allMachines().stream().map(MetaController::toMeta).toList());
    }

    private static MachineMeta toMeta(StateMachineDef def) {
        List<String> states = def.transitions().stream()
                .flatMap(t -> java.util.stream.Stream.of(t.from(), t.to()))
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        List<ActionMeta> actions = def.transitions().stream()
                .map(t -> new ActionMeta(t.action(), t.actionLabel(), t.from(), t.to()))
                .toList();
        return new MachineMeta(def.machineName(), def.objectType(), def.stateField(),
                states, List.copyOf(def.terminalStates()), actions);
    }

    /**
     * 三类字典的当前值。
     *
     * <p>7.5 写的是「4 类字典」，那是 V1.1 的口径——激励类型字典已随 N20（激励推二期）删除，
     * 现存三类：作战单元、课程分类、自检 CheckList 清单项。
     *
     * <p>只下发<b>启用中</b>的项：停用项仅在配置中心可见（规则 DC1「仅在新建时不再可选」）。
     */
    @GetMapping("/dicts")
    public R<Map<String, List<DictOption>>> dicts() {
        Map<String, List<DictOption>> result = new LinkedHashMap<>();
        result.put(DictQuery.TYPE_COMBAT_UNIT, options(DictQuery.TYPE_COMBAT_UNIT));
        result.put(DictQuery.TYPE_COURSE_CATEGORY, options(DictQuery.TYPE_COURSE_CATEGORY));
        result.put("自检CheckList清单项", selfchecks.list().stream()
                .filter(item -> Boolean.TRUE.equals(item.enabled()))
                .map(item -> new DictOption(String.valueOf(item.id()), item.itemText(), null))
                .toList());
        return R.ok(result);
    }

    public record DictOption(String code, String name, String parentCode) {
    }

    private List<DictOption> options(String dictType) {
        return dicts.list(dictType).stream()
                .filter(item -> Boolean.TRUE.equals(item.enabled()))
                .map(MetaController::toOption)
                .toList();
    }

    private static DictOption toOption(DictItem item) {
        return new DictOption(item.itemCode(), item.itemName(), item.parentCode());
    }

    /**
     * 三色灯阈值。前端展示「剩余 N 天」与灯色说明时需要——灯色本身由后端算（TD-4），
     * 这里下发的是阈值，让前端能把「距截止 2 天」解释成「蓝灯阈值 3 天内」。
     */
    @GetMapping("/thresholds")
    public R<List<ThresholdMeta>> thresholds() {
        return R.ok(thresholds.list().stream()
                .map(threshold -> new ThresholdMeta(threshold.objectType(), threshold.blueDays(),
                        threshold.redDays(), threshold.expectFinishFieldLabel()))
                .toList());
    }

    public record ThresholdMeta(String objectType, Integer blueDays, Integer redDays,
                                String expectFinishField) {
    }
}
