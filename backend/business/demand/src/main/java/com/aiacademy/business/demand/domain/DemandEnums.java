package com.aiacademy.business.demand.domain;

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

    /** 需求 8.3.1 第 13 项。<b>只用于列表排序与筛选，不驱动任何自动逻辑</b>。 */
    public static final List<String> PRIORITIES = List.of("高", "中", "低");

    /**
     * 需求 5.2.2 分流出口，<b>只有两个值</b>。
     *
     * <p>出口三「已有工具可直接复用」已由议题 1 更新答复与 D19 取消，不设第三项、不设「其他」。
     * 线下评审认为可以直接复用已有工具时仍走出口一：把「复用哪个工具、怎么用」写成解决方案。
     *
     * <p>这两个值<b>不是状态值</b>，是需求主表上的一个普通枚举字段——它决定后续激活哪一组
     * 状态字段（出口一→解决方案状态，出口二→需求开发状态），本身没有转换关系。
     */
    public static final String OUTLET_SOLUTION = "用现有工具输出解决方案";
    public static final String OUTLET_DEVELOPMENT = "造工具需求开发";
    public static final List<String> OUTLETS = List.of(OUTLET_SOLUTION, OUTLET_DEVELOPMENT);

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
        map.put("需求优先级", PRIORITIES);
        map.put("需求分流出口", OUTLETS);
        map.put("需求验收结论", ACCEPTANCE_RESULTS);
        return Map.copyOf(map);
    }
}
