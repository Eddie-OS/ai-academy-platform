package com.aiacademy.platform.dict.controller;

import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.platform.dict.domain.DictItem;
import com.aiacademy.platform.dict.domain.DictItemForm;
import com.aiacademy.platform.dict.domain.SelfcheckItem;
import com.aiacademy.platform.dict.domain.SelfcheckItemForm;
import com.aiacademy.platform.dict.domain.TaskDeriveRule;
import com.aiacademy.platform.dict.domain.WarningThreshold;
import com.aiacademy.platform.dict.service.DictConfigService;
import com.aiacademy.platform.dict.service.DictQuery;
import com.aiacademy.platform.dict.service.SelfcheckConfigService;
import com.aiacademy.platform.dict.service.TaskDeriveRuleService;
import com.aiacademy.platform.dict.service.WarningThresholdService;
import com.aiacademy.platform.escalation.domain.EscalationConfig;
import com.aiacademy.platform.escalation.domain.EscalationConfigForm;
import com.aiacademy.platform.escalation.service.EscalationConfigService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 配置中心（需求 13.9）。单页面多 Tab，接口收在一个 Controller 里按 Tab 分段。
 *
 * <p>阶段 4 已补催办配置 Tab（13.9.5）。负责人配置（13.9.4）仍未做（见待修清单 D-5）。
 *
 * <p>读接口对两个账号都开放（纪律 PMI-2）。13.9.1 的「仅运营角色可见可用」由前端不渲染入口
 * （纪律 PMI-5）与写接口的 {@link WriteApi} 共同保证。
 */
@RestController
@RequestMapping("/api/config")
@Validated
public class ConfigController {

    private final WarningThresholdService thresholds;
    private final DictConfigService dicts;
    private final SelfcheckConfigService selfchecks;
    private final TaskDeriveRuleService deriveRules;
    private final EscalationConfigService escalationConfig;

    public ConfigController(WarningThresholdService thresholds,
                            DictConfigService dicts,
                            SelfcheckConfigService selfchecks,
                            TaskDeriveRuleService deriveRules,
                            EscalationConfigService escalationConfig) {
        this.thresholds = thresholds;
        this.dicts = dicts;
        this.selfchecks = selfchecks;
        this.deriveRules = deriveRules;
        this.escalationConfig = escalationConfig;
    }

    // -------------------------------------------------------------------------
    // Tab 1 · 三色灯阈值（需求 13.9.2）
    // -------------------------------------------------------------------------

    public record ThresholdRow(Long id, String objectType, Integer blueDays, Integer redDays,
                               String expectFinishField, String updatedAt, String updatedBy) {

        static ThresholdRow of(WarningThreshold threshold) {
            return new ThresholdRow(threshold.id(), threshold.objectType(),
                    threshold.blueDays(), threshold.redDays(),
                    threshold.expectFinishFieldLabel(),
                    threshold.updatedAt() == null ? null : threshold.updatedAt().toString(),
                    threshold.updatedBy());
        }
    }

    public record ThresholdForm(
            @NotNull(message = "请填写蓝灯阈值")
            @Min(value = 1, message = "蓝灯阈值取值范围是 1–30 天")
            @Max(value = 30, message = "蓝灯阈值取值范围是 1–30 天")
            Integer blueDays,

            @NotNull(message = "请填写红灯阈值")
            @Min(value = 1, message = "红灯阈值取值范围是 1–90 天")
            @Max(value = 90, message = "红灯阈值取值范围是 1–90 天")
            Integer redDays) {
    }

    @GetMapping("/thresholds")
    public R<List<ThresholdRow>> thresholds() {
        return R.ok(thresholds.list().stream().map(ThresholdRow::of).toList());
    }

    @WriteApi
    @PutMapping("/thresholds/{id}")
    public R<Void> updateThreshold(@PathVariable long id, @Valid @RequestBody ThresholdForm form) {
        thresholds.update(id, form.blueDays(), form.redDays());
        return R.ok();
    }

    // -------------------------------------------------------------------------
    // Tab 2 · 字典配置（需求 13.9.3）
    // -------------------------------------------------------------------------

    /**
     * 可配置的字典类型清单。
     *
     * <p>存在这个接口的理由与导入类型清单相同：<b>前端不手写字典类型名</b>（纪律 STK-1）。
     * 字典类型是 {@code dict_item.dict_type} 的 CHECK 约束取值，写在前端就成了第二份定义。
     *
     * @param hierarchical 是否有上级分类。课程分类有二级结构，作战单元是平的；
     *                     前端据此决定「上级分类」这一列与表单项是否出现
     */
    public record DictTypeOption(String dictType, boolean hierarchical) {
    }

    @GetMapping("/dicts")
    public R<List<DictTypeOption>> dictTypes() {
        return R.ok(List.of(
                new DictTypeOption(DictQuery.TYPE_COMBAT_UNIT, false),
                new DictTypeOption(DictQuery.TYPE_COURSE_CATEGORY, true)));
    }

    @GetMapping("/dicts/{dictType}/items")
    public R<List<DictItem>> dictItems(@PathVariable String dictType) {
        return R.ok(dicts.list(dictType));
    }

    @WriteApi
    @PostMapping("/dicts/{dictType}/items")
    public R<Long> createDictItem(@PathVariable String dictType, @Valid @RequestBody DictItemForm form) {
        return R.ok(dicts.create(dictType, form));
    }

    @WriteApi
    @PutMapping("/dicts/items/{id}")
    public R<Void> updateDictItem(@PathVariable long id, @Valid @RequestBody DictItemForm form) {
        dicts.update(id, form);
        return R.ok();
    }

    @WriteApi
    @DeleteMapping("/dicts/items/{id}")
    public R<Void> deleteDictItem(@PathVariable long id) {
        dicts.delete(id);
        return R.ok();
    }

    // -------------------------------------------------------------------------
    // Tab 3 · 自检 CheckList 题库（需求 9.4.1、13.9.3）
    // -------------------------------------------------------------------------

    @GetMapping("/selfcheck-items")
    public R<List<SelfcheckItem>> selfcheckItems() {
        return R.ok(selfchecks.list());
    }

    /** 说明文本必填性的三个取值（无／选填／必填）。同样是为了前端不手写枚举（STK-1）。 */
    @GetMapping("/selfcheck-items/note-requirements")
    public R<List<String>> noteRequirements() {
        return R.ok(SelfcheckItem.NOTE_REQUIREMENTS);
    }

    @WriteApi
    @PostMapping("/selfcheck-items")
    public R<Long> createSelfcheckItem(@Valid @RequestBody SelfcheckItemForm form) {
        return R.ok(selfchecks.create(form));
    }

    @WriteApi
    @PutMapping("/selfcheck-items/{id}")
    public R<Void> updateSelfcheckItem(@PathVariable long id, @Valid @RequestBody SelfcheckItemForm form) {
        selfchecks.update(id, form);
        return R.ok();
    }

    @WriteApi
    @DeleteMapping("/selfcheck-items/{id}")
    public R<Void> deleteSelfcheckItem(@PathVariable long id) {
        selfchecks.delete(id);
        return R.ok();
    }

    // -------------------------------------------------------------------------
    // Tab 4 · 任务派生规则（需求 13.1.2）
    // -------------------------------------------------------------------------

    public record DeriveRuleRow(Long id, String taskType, String titleTemplate, String ownerSource,
                                String dueBaseLabel, Integer dueOffsetDays, Boolean fixedByObjectField,
                                Boolean enabled, String updatedAt, String updatedBy) {

        static DeriveRuleRow of(TaskDeriveRule rule) {
            return new DeriveRuleRow(rule.id(), rule.taskType(), rule.titleTemplate(),
                    rule.ownerSource(), rule.dueBaseLabel(), rule.dueOffsetDays(),
                    rule.takesDueFromObjectField(), rule.enabled(),
                    rule.updatedAt() == null ? null : rule.updatedAt().toString(),
                    rule.updatedBy());
        }
    }

    public record DeriveRuleForm(
            @Size(max = 200, message = "任务标题模板不超过 200 字")
            String titleTemplate,

            // 取对象字段的规则（课程开发）传 null，其余必填。是哪条规则只有 Service 知道，
            // 因此「必填」这一半的校验在 Service 里
            @Min(value = 1, message = "默认截止天数取值 1–365 天")
            @Max(value = 365, message = "默认截止天数取值 1–365 天")
            Integer dueOffsetDays,

            @NotNull(message = "请选择启用状态")
            Boolean enabled) {
    }

    @GetMapping("/task-derive-rules")
    public R<List<DeriveRuleRow>> taskDeriveRules() {
        return R.ok(deriveRules.list().stream().map(DeriveRuleRow::of).toList());
    }

    @WriteApi
    @PutMapping("/task-derive-rules/{id}")
    public R<Void> updateTaskDeriveRule(@PathVariable long id, @Valid @RequestBody DeriveRuleForm form) {
        deriveRules.update(id, form.titleTemplate(), form.dueOffsetDays(), form.enabled());
        return R.ok();
    }

    // -------------------------------------------------------------------------
    // Tab · 催办配置（需求 13.9.5，阶段 4）
    // -------------------------------------------------------------------------

    public record EscalationConfigRow(
            Long id, Integer cycleWeekday, String cycleTime, Boolean listEnabled,
            Boolean appendBlue, Boolean appendYellow, Boolean appendRed,
            String templateText, Integer minIntervalHours, Integer preSessionDays,
            String updatedAt, String updatedBy) {

        static EscalationConfigRow of(EscalationConfig cfg) {
            return new EscalationConfigRow(
                    cfg.id(), cfg.cycleWeekday(), cfg.cycleTime().toString(),
                    cfg.listEnabled(), cfg.appendBlue(), cfg.appendYellow(), cfg.appendRed(),
                    cfg.templateText(), cfg.minIntervalHours(), cfg.preSessionDays(),
                    cfg.updatedAt() == null ? null : cfg.updatedAt().toString(),
                    cfg.updatedBy());
        }
    }

    @GetMapping("/escalation")
    public R<EscalationConfigRow> escalationConfig() {
        return R.ok(EscalationConfigRow.of(escalationConfig.get()));
    }

    @WriteApi
    @PutMapping("/escalation/{id}")
    public R<Void> updateEscalationConfig(@PathVariable long id,
                                          @Valid @RequestBody EscalationConfigForm form) {
        escalationConfig.update(id, form);
        return R.ok();
    }
}
