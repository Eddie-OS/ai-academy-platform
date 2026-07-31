package com.aiacademy.platform.dict.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.audit.AuditLog;
import com.aiacademy.platform.audit.AuditSnapshotSource;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.dict.domain.TaskDeriveRule;
import com.aiacademy.platform.dict.repository.TaskDeriveRuleMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 任务派生规则（需求 13.1.2、开发 5.9.1）。10 条固定规则，可改标题模板、截止天数与启用状态。
 *
 * <p>本期<b>没有消费方</b>——任务自动派生在阶段 3。把配置与消费拆到两个阶段是刻意的：
 * 需求 13.1.2 的 10 条规则此刻已经确定，先落成数据，阶段 3 实现派生时就不会为了「先跑起来」
 * 在代码里硬编码一份天数，而硬编码一旦写进去就不会再被删掉。
 */
@Service
public class TaskDeriveRuleService implements AuditSnapshotSource {

    public static final String OBJECT_TYPE = "TASK_DERIVE_RULE";

    private final TaskDeriveRuleMapper rules;

    public TaskDeriveRuleService(TaskDeriveRuleMapper rules) {
        this.rules = rules;
    }

    @Transactional(readOnly = true)
    public List<TaskDeriveRule> list() {
        return rules.findAll();
    }

    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.UPDATE)
    public void update(long id, String titleTemplate, Integer dueOffsetDays, boolean enabled) {
        TaskDeriveRule current = rules.findById(id);
        if (current == null) {
            throw new NotFoundException("任务派生规则不存在：" + id);
        }
        if (titleTemplate == null || titleTemplate.isBlank() || titleTemplate.length() > 200) {
            throw new BizException(ErrorCode.PARAM_INVALID, "任务标题模板必填，且不超过 200 字");
        }
        if (current.takesDueFromObjectField()) {
            // 课程开发那条的截止时间取「课程预计发布时间」，没有天数可调（开发 5.9.1）
            if (dueOffsetDays != null) {
                throw new BizException(ErrorCode.PARAM_INVALID,
                        "「%s」的截止时间取自对象字段（%s），不使用偏移天数"
                                .formatted(current.taskType(), current.dueBaseLabel()));
            }
        } else if (dueOffsetDays == null || dueOffsetDays < 1 || dueOffsetDays > 365) {
            throw new BizException(ErrorCode.PARAM_INVALID, "默认截止天数必填，取值 1–365 天");
        }
        rules.update(id, titleTemplate.trim(), dueOffsetDays, enabled, operator());
    }

    @Override
    public Map<String, Object> auditSnapshot(long objectId) {
        TaskDeriveRule rule = rules.findById(objectId);
        if (rule == null) {
            return Map.of();
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put(rule.taskType() + "·任务标题模板", rule.titleTemplate());
        snapshot.put(rule.taskType() + "·默认截止天数", rule.dueOffsetDays());
        snapshot.put(rule.taskType() + "·启用状态", rule.enabled() ? "启用" : "停用");
        return snapshot;
    }

    private String operator() {
        return OperatorContext.current().account().name();
    }
}
