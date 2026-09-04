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

    /**
     * 全部字典类型，供 {@code /api/meta/dicts} 一次性下发（纪律 STK-1）。
     *
     * <p>先前 {@code MetaController.dicts()} 是一条条 {@code put} 的，只 put 了作战单元与课程分类
     * 两类。阶段 5 加进来的另外 12 类<b>一类都没下发</b>，于是立项、评审、自检、试讲四个台账页
     * 的下拉框在前端没有数据来源——按 STK-1 前端不许自己写状态与枚举字面量，所以那些下拉
     * 要么是空的，要么被硬编码了一份。
     *
     * <p>改成遍历这份清单，是为了让「新增一类字典」只需要在这个文件里改一处。
     * 这份清单与表上的 {@code ck_dict_type} 约束由 {@code DictTypeCoverageTest} 交叉验证：
     * 两边都是手工维护的，而漏掉一类的表现不是报错，是某个下拉框安静地空掉。
     */
    public static final List<String> ALL_TYPES = List.of(
            TYPE_COMBAT_UNIT,
            TYPE_COURSE_CATEGORY,
            TYPE_COURSE_INITIATION_STATUS,
            TYPE_COURSE_INITIATION_REVIEW_CONCLUSION,
            TYPE_COURSE_SELFCHECK_RECORD_STATUS,
            TYPE_COURSE_SELFCHECK_CONCLUSION,
            TYPE_COURSE_REVIEW_PHASE,
            TYPE_COURSE_REVIEW_LEDGER_STATUS,
            TYPE_PRELIM_REVIEW_CONCLUSION,
            TYPE_MEETING_CONCLUSION,
            TYPE_COURSE_TRIAL_PHASE,
            TYPE_COURSE_TRIAL_LEDGER_STATUS,
            TYPE_COURSE_TRIAL_FORMAT,
            TYPE_TRIAL_ACCEPTANCE_RESULT);

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
