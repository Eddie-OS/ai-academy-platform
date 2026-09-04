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
     * 字典类型白名单，与 {@code dict_item} 上的 {@code ck_dict_type} 约束同一套取值。
     *
     * <p>自检 CheckList 清单项虽然在需求 13.9.3 的表格里与它们并列，但因为要快照题目文本而单独
     * 建了表（开发 6.3.9），走 {@code SelfcheckConfigService}，不在这份清单里。
     *
     * <p><b>这里曾经写死「只有作战单元与课程分类两类」</b>，注释还说「CHECK 约束同样只允许这两类」。
     * 阶段 5 的课程工作台加了 12 类并逐个放开了 CHECK，这个方法没跟上，于是
     * {@code GET /api/meta/dicts} 一旦下发那 12 类就整个请求 400——注意<b>坏掉的是整个接口</b>，
     * 不是缺一类：前端拿不到任何字典，所有下拉框一起空掉。
     *
     * <p>改成查 {@link DictQuery#ALL_TYPES}，这样新增一类字典只需改那一处；
     * 那份清单与 CHECK 约束由 {@code SchemaConventionTest} 交叉验证。
     */
    private String requireKnownType(String dictType) {
        if (DictQuery.ALL_TYPES.contains(dictType)) {
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
