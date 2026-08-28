package com.aiacademy.platform.dict.service;

import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.audit.AuditLog;
import com.aiacademy.platform.audit.AuditSnapshotSource;
import com.aiacademy.platform.audit.domain.OpType;
import com.aiacademy.platform.dict.domain.DictItem;
import com.aiacademy.platform.dict.domain.DictItemForm;
import com.aiacademy.platform.dict.repository.DictItemMapper;
import com.aiacademy.platform.dict.repository.DictReferenceMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 字典配置（需求 13.9.3 Tab 2）的维护入口，实现规则 DC1～DC4。
 *
 * <p>四条规则里有三条是<b>删除与停用的边界</b>，它们的共同点是：违反后不报错，只是让历史数据
 * 静默指向一个不存在的取值。因此每一条都在这里显式拦下，并给出「该怎么做」的文案，
 * 而不是只说「不允许」。
 */
@Service
public class DictConfigService implements AuditSnapshotSource {

    /** 审计日志的对象类型码。与 {@code audit_op_log.object_type} 同一套取值。 */
    public static final String OBJECT_TYPE = "DICT_ITEM";

    private final DictItemMapper items;
    private final DictReferenceMapper references;

    public DictConfigService(DictItemMapper items, DictReferenceMapper references) {
        this.items = items;
        this.references = references;
    }

    @Transactional(readOnly = true)
    public List<DictItem> list(String dictType) {
        return items.findAll(requireKnownType(dictType));
    }

    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.CREATE, objectId = AuditLog.ObjectIdSource.RETURN_VALUE)
    public long create(String dictType, DictItemForm form) {
        String type = requireKnownType(dictType);
        if (items.countByCode(type, form.itemCode()) > 0) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "编码「%s」在%s字典中已存在".formatted(form.itemCode(), type));
        }
        requireParentExists(type, form.parentCode());
        return items.insert(type, form.itemCode(), form.itemName(), blankToNull(form.parentCode()),
                form.seqNo(), form.enabled(), operator());
    }

    /**
     * 修改。编码不参与更新（规则 DC2），停用要过 DC4 的最后一条检查。
     */
    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.UPDATE)
    public void update(long id, DictItemForm form) {
        DictItem current = require(id);
        requireParentExists(current.dictType(), form.parentCode());
        if (form.parentCode() != null && form.parentCode().equals(current.itemCode())) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED, "上级分类不能是自己");
        }
        if (!form.enabled() && current.enabled()) {
            requireNotLastCombatUnit(current, "停用");
        }
        items.update(id, form.itemName(), blankToNull(form.parentCode()),
                form.seqNo(), form.enabled(), operator());
    }

    /**
     * 删除（逻辑删除）。规则 DC1：已被引用时不可删，只可停用。
     *
     * <p>错误文案里带上引用数：运营看到「已被 37 处引用」才会理解为什么要改用停用，
     * 只说「不允许删除」会被当成系统限制而反复重试。
     */
    @Transactional
    @AuditLog(objectType = OBJECT_TYPE, op = OpType.DELETE)
    public void delete(long id) {
        DictItem item = require(id);
        long used = countReferences(item);
        if (used > 0) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "「%s」已被 %d 处引用，不能删除。请改为停用——停用不影响已有数据，只是新建时不再可选"
                            .formatted(item.itemName(), used));
        }
        if (item.enabled()) {
            requireNotLastCombatUnit(item, "删除");
        }
        items.logicalDelete(id, operator());
    }

    private long countReferences(DictItem item) {
        return switch (item.dictType()) {
            case DictQuery.TYPE_COMBAT_UNIT ->
                    references.countCombatUnitReferences(item.itemCode(), item.itemName());
            case DictQuery.TYPE_COURSE_CATEGORY ->
                    references.countCourseCategoryReferences(item.itemCode(), item.itemName());
            default -> 0;
        };
    }

    /** 规则 DC4：作战单元字典不允许少于 1 条启用项——它是首页与五个驾驶舱的分组维度。 */
    private void requireNotLastCombatUnit(DictItem item, String action) {
        if (!DictQuery.TYPE_COMBAT_UNIT.equals(item.dictType())) {
            return;
        }
        if (items.countEnabledExcept(item.dictType(), item.id()) == 0) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "「%s」是最后一个启用中的作战单元，不能%s：总看板与五个驾驶舱都按作战单元分组，"
                            .formatted(item.itemName(), action)
                            + "分组维度为空时首页无法展示");
        }
    }

    private void requireParentExists(String dictType, String parentCode) {
        String parent = blankToNull(parentCode);
        if (parent == null) {
            return;
        }
        if (!DictQuery.TYPE_COURSE_CATEGORY.equals(dictType)) {
            throw new BizException(ErrorCode.PARAM_INVALID, "只有课程分类支持上级分类（需求 13.9.3）");
        }
        boolean exists = items.findAll(dictType).stream()
                .anyMatch(item -> item.itemCode().equals(parent));
        if (!exists) {
            throw new BizException(ErrorCode.PARAM_INVALID, "上级分类编码不存在：" + parent);
        }
    }

    private DictItem require(long id) {
        DictItem item = items.findById(id);
        if (item == null) {
            throw new NotFoundException("字典项不存在或已删除：" + id);
        }
        return item;
    }

    /**
     * {@code dict_item} 上 CHECK 允许的类型。配置中心 Tab 只挂作战单元与课程分类
     * （{@code ConfigController} 的类型列表）；立项两类由种子脚本维护，这里放行是为了
     * {@code /api/meta/dicts} 能下发，前端不手写选项。
     *
     * <p>自检 CheckList 清单项单独建了表（开发 6.3.9），走 {@code SelfcheckConfigService}。
     */
    private String requireKnownType(String dictType) {
        if (DictQuery.TYPE_COMBAT_UNIT.equals(dictType)
                || DictQuery.TYPE_COURSE_CATEGORY.equals(dictType)
                || DictQuery.TYPE_COURSE_INITIATION_STATUS.equals(dictType)
                || DictQuery.TYPE_COURSE_INITIATION_REVIEW_CONCLUSION.equals(dictType)
                || DictQuery.TYPE_COURSE_SELFCHECK_RECORD_STATUS.equals(dictType)
                || DictQuery.TYPE_COURSE_SELFCHECK_CONCLUSION.equals(dictType)
                || DictQuery.TYPE_COURSE_REVIEW_PHASE.equals(dictType)
                || DictQuery.TYPE_COURSE_REVIEW_LEDGER_STATUS.equals(dictType)
                || DictQuery.TYPE_PRELIM_REVIEW_CONCLUSION.equals(dictType)
                || DictQuery.TYPE_MEETING_CONCLUSION.equals(dictType)
                || DictQuery.TYPE_COURSE_TRIAL_PHASE.equals(dictType)
                || DictQuery.TYPE_COURSE_TRIAL_LEDGER_STATUS.equals(dictType)
                || DictQuery.TYPE_COURSE_TRIAL_FORMAT.equals(dictType)
                || DictQuery.TYPE_TRIAL_ACCEPTANCE_RESULT.equals(dictType)) {
            return dictType;
        }
        throw new BizException(ErrorCode.PARAM_INVALID, "未知的字典类型：" + dictType);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Override
    public Map<String, Object> auditSnapshot(long objectId) {
        DictItem item = items.findById(objectId);
        if (item == null) {
            return Map.of();
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("名称", item.itemName());
        snapshot.put("上级分类", item.parentCode());
        snapshot.put("排序号", item.seqNo());
        snapshot.put("启用状态", item.enabled() ? "启用" : "停用");
        return snapshot;
    }

    private String operator() {
        return OperatorContext.current().account().name();
    }
}
