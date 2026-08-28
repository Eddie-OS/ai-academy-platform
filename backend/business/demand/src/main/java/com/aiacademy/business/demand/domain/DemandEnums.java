package com.aiacademy.business.demand.domain;

import com.aiacademy.platform.dict.domain.BusinessDomains;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 需求模块的<b>字段枚举</b>全集（需求第 8 章）。状态枚举不在这里——那些由状态机转换表定义，
 * 经 {@code /api/meta/enums} 下发。
 *
 * <p>集中一处的理由同 {@code CourseEnums}：这些取值同时是建表脚本的 CHECK 约束、后端的入参
 * 校验与前端的下拉选项，散成三份必然漂移（纪律 STK-1）。与 CHECK 约束的一致性由
 * {@code FieldEnumConstraintTest} 拿真实 schema 核对。
 */
public final class DemandEnums {

    private DemandEnums() {
    }

    /** 需求 8.3.1 第 11 项，V1.2 确认按此 5 值实现。 */
    public static final List<String> SOURCES =
            List.of("部门提出", "个人提出", "培训反馈", "案例反推", "战略任务");

    /** 需求 8.3.1 第 12 项，V1.2 确认按此 5 值实现。 */
    public static final List<String> TYPES =
            List.of("效率提升", "质量改善", "成本降低", "风险控制", "体验优化");

    /**
     * 需求所属领域（现场口径 D-21）。最后一项「手动输入」只出现在表单，不入库。
     * 与作战单元字典并存：历史数据仍可能是 AI_DEMAND／COURSE 等编码。
     */
    public static final List<String> DOMAINS = BusinessDomains.NAMES;
    public static final String DOMAIN_MANUAL = "手动输入";

    /**
     * 需求优先级（现场口径 D-21）。需求 8.3.1 原文是高／中／低，表单改为 P0／P1／P2。
     * <b>只用于列表排序与筛选，不驱动任何自动逻辑</b>。
     */
    public static final List<String> PRIORITIES = List.of("P0（紧急重要）", "P1（重要）", "P2（一般）");

    /**
     * 分流出口（需求 5.2.2 + 现场口径 D-20）。
     *
     * <p>需求 5.2.2 原文只有两个值；出口三「已有工具可直接复用」已由议题 1 与 D19 取消。
     * 现场要求补第三条「需求驳回」：不激活解决方案／需求开发状态组，处理状态固定展示「结束」，
     * 并退出预警。与 5.2.2「仅此两值」的冲突记在 {@code docs/文档待修清单.md} D-20。
     *
     * <p>这三个值<b>不是状态值</b>，是需求主表上的普通枚举字段——前两条决定激活哪一组
     * 状态字段，第三条没有对应状态机。
     */
    public static final String OUTLET_SOLUTION = "用现有工具输出解决方案";
    public static final String OUTLET_DEVELOPMENT = "造工具需求开发";
    public static final String OUTLET_REJECT = "需求驳回";
    public static final List<String> OUTLETS = List.of(OUTLET_SOLUTION, OUTLET_DEVELOPMENT, OUTLET_REJECT);

    /**
     * 评审结论（详情「评审信息」页签）。与分流出口一一对应，只改展示文案，不改出口存储值。
     *
     * <p>顺序与 {@link #OUTLETS} 相同：解决方案 / 需求开发 / 驳回。
     */
    public static final String CONCLUSION_SOLUTION = "评审通过-解决方案";
    public static final String CONCLUSION_DEVELOPMENT = "评审通过-需求开发";
    public static final String CONCLUSION_REJECT = "驳回";
    public static final List<String> REVIEW_CONCLUSIONS =
            List.of(CONCLUSION_SOLUTION, CONCLUSION_DEVELOPMENT, CONCLUSION_REJECT);

    /** 评审结论 → 分流出口。对不上时返回 {@code null}，由调用方报 PARAM_INVALID。 */
    public static String outletOfConclusion(String conclusion) {
        if (CONCLUSION_SOLUTION.equals(conclusion)) {
            return OUTLET_SOLUTION;
        }
        if (CONCLUSION_DEVELOPMENT.equals(conclusion)) {
            return OUTLET_DEVELOPMENT;
        }
        if (CONCLUSION_REJECT.equals(conclusion)) {
            return OUTLET_REJECT;
        }
        return null;
    }

    /**
     * 处理状态列的展示值（不是状态机状态）。
     *
     * <p>出口一尚未「输出解决方案」时解决方案状态仍为空，列表不能再写「—」，
     * 按现场口径展示「待输出」。出口三没有状态列，固定展示「结束」。
     */
    public static final String PROCESS_PENDING_OUTPUT = "待输出";
    public static final String PROCESS_ENDED = "结束";

    /**
     * 交付标记尚未写入时的展示值（不是状态机状态）。
     *
     * <p>需求交付标记的转换从空到「已交付」，空不能落库成一个状态值，表单用这个词表示未交付。
     */
    public static final String DELIVERY_UNDELIVERED = "未交付";

    /**
     * 需求 5.2.5 落地要点第 5 条：验收结论<b>只有通过／不通过两个值</b>，加一段文字意见。
     * 不做价值量化回收（N14），不比对上线前后数据、不算 ROI。
     *
     * <p>这两个值<b>不是状态值</b>：状态是「验收通过／验收不通过」，落在 {@code acceptance_state}
     * 列上、由状态机写；这里的是验收记录表上的结论列 {@code acceptance_result}，也是接口入参——
     * 前端选「通过」，后端据此挑走哪条转换（见 {@code DemandApplicationService}）。
     */
    public static final String ACCEPTANCE_PASS = "通过";
    public static final String ACCEPTANCE_REJECT = "不通过";
    public static final List<String> ACCEPTANCE_RESULTS = List.of(ACCEPTANCE_PASS, ACCEPTANCE_REJECT);

    /** 各枚举的对外形态，供 {@code /api/meta/field-enums} 下发（纪律 STK-1）。 */
    public static Map<String, List<String>> forMetaApi() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("需求来源", SOURCES);
        map.put("需求类型", TYPES);
        map.put("需求所属领域", DOMAINS);
        map.put("需求优先级", PRIORITIES);
        map.put("需求分流出口", OUTLETS);
        map.put("需求评审结论", REVIEW_CONCLUSIONS);
        map.put("需求验收结论", ACCEPTANCE_RESULTS);
        map.put("解决方案待输出", List.of(PROCESS_PENDING_OUTPUT));
        map.put("需求未交付展示", List.of(DELIVERY_UNDELIVERED));
        return Map.copyOf(map);
    }
}
