package com.aiacademy.platform.dict.service;

import com.aiacademy.platform.dict.repository.DictItemMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 字典读取（需求 13.9.3）。
 *
 * <p><b>作战单元不得硬编码为五个值</b>（需求 13.9.3 明确：字典允许后续扩展，例如新增「工具平台」
 * 「组织推广」）。因此讲师导入的「擅长领域」校验必须查这张表，不能写成枚举——写成枚举时，运营在
 * 配置中心加了一个作战单元，讲师导入却会把它判成非法值。
 */
@Service
public class DictQuery {

    /** {@code dict_item.dict_type} 的取值，与表上的 CHECK 约束一致。 */
    public static final String TYPE_COMBAT_UNIT = "作战单元";
    public static final String TYPE_COURSE_CATEGORY = "课程分类";
    public static final String TYPE_COURSE_INITIATION_STATUS = "课程立项状态";
    public static final String TYPE_COURSE_INITIATION_REVIEW_CONCLUSION = "课程立项评审结论";
    public static final String TYPE_COURSE_SELFCHECK_RECORD_STATUS = "课程自检记录状态";
    public static final String TYPE_COURSE_SELFCHECK_CONCLUSION = "课程自检结论";
    public static final String TYPE_COURSE_REVIEW_PHASE = "课程评审阶段";
    public static final String TYPE_COURSE_REVIEW_LEDGER_STATUS = "课程评审台账状态";
    public static final String TYPE_PRELIM_REVIEW_CONCLUSION = "初步评审结论";
    public static final String TYPE_MEETING_CONCLUSION = "上会最终结论";
    public static final String TYPE_COURSE_TRIAL_PHASE = "课程试讲阶段";
    public static final String TYPE_COURSE_TRIAL_LEDGER_STATUS = "课程试讲台账状态";
    public static final String TYPE_COURSE_TRIAL_FORMAT = "课程试讲形式";
    public static final String TYPE_TRIAL_ACCEPTANCE_RESULT = "试讲验收结果";

    private final DictItemMapper mapper;

    public DictQuery(DictItemMapper mapper) {
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<String> enabledNames(String dictType) {
        return mapper.findEnabledNames(dictType);
    }

    @Transactional(readOnly = true)
    public Set<String> enabledNameSet(String dictType) {
        return new LinkedHashSet<>(mapper.findEnabledNames(dictType));
    }

    /** 启用项编码。业务主表的 {@code domain_code}、{@code category_code} 存的是编码而非名称。 */
    @Transactional(readOnly = true)
    public Set<String> enabledCodeSet(String dictType) {
        return new LinkedHashSet<>(mapper.findEnabledCodes(dictType));
    }
}
