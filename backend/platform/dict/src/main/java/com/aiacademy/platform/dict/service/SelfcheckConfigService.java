package com.aiacademy.platform.dict.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.audit.AuditLog;
import com.aiacademy.platform.audit.AuditSnapshotSource;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.dict.domain.SelfcheckItem;
import com.aiacademy.platform.dict.domain.SelfcheckItemForm;
import com.aiacademy.platform.dict.repository.SelfcheckItemMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 自检 CheckList 题库（需求 9.4.1、13.9.3 Tab 3）。
 *
 * <p>题库能改，是因为原始需求文档的清单以「…」结尾，表明条目会增加（需求 9.4.1）。
 * 能改就必须守住两件事：
 * <ul>
 *   <li><b>锁定条目不允许停用</b>——需求 9.4.1 列明的 5 条来自原始需求文档，改文案可以，停用不行；
 *   <li><b>被引用过的题目不允许删除</b>（规则 CK5）——历史课程的自检记录仍要能查看。
 * </ul>
 */
@Service
public class SelfcheckConfigService implements AuditSnapshotSource {

    public static final String OBJECT_TYPE = "SELFCHECK_ITEM";

    private final SelfcheckItemMapper items;

    public SelfcheckConfigService(SelfcheckItemMapper items) {
        this.items = items;
    }

    @Transactional(readOnly = true)
    public List<SelfcheckItem> list() {
        return items.findAll();
    }

    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.CREATE, objectId = AuditLog.ObjectIdSource.RETURN_VALUE)
    public long create(SelfcheckItemForm form) {
        requireNoteRequirement(form.noteRequirement());
        requireFreeSeq(form.seq(), 0);
        // locked 恒为 FALSE：锁定表达「来自需求文档 9.4.1」，新增的条目不可能属于那 5 条
        return items.insert(form.groupName(), form.seq(), form.itemText(), form.noteRequirement(),
                blankToNull(form.guideText()), form.enabled(), operator());
    }

    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.UPDATE)
    public void update(long id, SelfcheckItemForm form) {
        SelfcheckItem current = require(id);
        requireNoteRequirement(form.noteRequirement());
        requireFreeSeq(form.seq(), id);
        if (current.locked() && !form.enabled()) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "「%s」是需求文档 9.4.1 列明的锁定条目，不允许停用；文案可以改"
                            .formatted(current.itemText()));
        }
        items.update(id, form.groupName(), form.seq(), form.itemText(), form.noteRequirement(),
                blankToNull(form.guideText()), form.enabled(), operator());
    }

    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.DELETE)
    public void delete(long id) {
        SelfcheckItem item = require(id);
        if (item.locked()) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "「%s」是需求文档 9.4.1 列明的锁定条目，不允许删除".formatted(item.itemText()));
        }
        long used = items.countUsages(id);
        if (used > 0) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "「%s」已被 %d 门课程的自检记录引用，不能删除。请改为停用——停用后历史记录仍可查看，"
                            .formatted(item.itemText(), used)
                            + "只是不再计入完成度分母（规则 CK5）");
        }
        items.logicalDelete(id, operator());
    }

    private void requireNoteRequirement(String value) {
        if (!SelfcheckItem.NOTE_REQUIREMENTS.contains(value)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "说明的必填性只能是：" + String.join(" / ", SelfcheckItem.NOTE_REQUIREMENTS));
        }
    }

    /**
     * 排序号全表唯一。这是 {@code uk_selfcheck_item_seq} 的语义，不是本方法自己加的约束——
     * 唯一排序号让「调整顺序」变成改一个数字，而不是整组重排。
     */
    private void requireFreeSeq(int seq, long selfId) {
        if (items.countBySeq(seq, selfId) > 0) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "排序号 %d 已被占用。建议用 10、20、30 这样的间隔，便于插入新条目".formatted(seq));
        }
    }

    private SelfcheckItem require(long id) {
        SelfcheckItem item = items.findById(id);
        if (item == null) {
            throw new NotFoundException("自检清单项不存在或已删除：" + id);
        }
        return item;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Override
    public Map<String, Object> auditSnapshot(long objectId) {
        SelfcheckItem item = items.findById(objectId);
        if (item == null) {
            return Map.of();
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("所属分组", item.groupName());
        snapshot.put("排序号", item.seq());
        snapshot.put("检查项描述", item.itemText());
        snapshot.put("说明必填性", item.noteRequirement());
        snapshot.put("填写指引", item.guideText());
        snapshot.put("启用状态", item.enabled() ? "启用" : "停用");
        return snapshot;
    }

    private String operator() {
        return OperatorContext.current().account().name();
    }
}
