package com.aiacademy.business.kase.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 案例域的字段枚举（需求第 12 章）。状态枚举不在这里——那由 {@code CaseStateMachines} 的转换表
 * 定义，经 {@code /api/meta/enums} 下发。
 *
 * <p>集中一处的理由同 {@code CourseEnums}：纪律 STK-1 禁止前端手写枚举字面量，而这些取值同时是
 * 建表脚本的 CHECK 约束、后端的入参校验与前端的下拉选项。与 CHECK 的一致性由
 * {@code FieldEnumConstraintTest} 拿真实 schema 核对。
 */
public final class CaseEnums {

    private CaseEnums() {
    }

    /**
     * 审核结论（需求 12.3 第 9d 项）。<b>后一次审核覆盖前一次，不记轮次</b>（C09 第 4 条）——
     * 与需求的业务验收刚好相反，那边有 {@code dtl_demand_acceptance} 记录每一轮。
     */
    public static final String AUDIT_PASS = "通过";
    public static final String AUDIT_REJECT = "不通过";
    public static final List<String> REVIEW_RESULTS = List.of(AUDIT_PASS, AUDIT_REJECT);

    /** 精品标注（需求 12.3 第 10 项），多选。取值与课程侧同名字段一致，由线下评审决定后标注。 */
    public static final String MARK_TOP = "精品";
    public static final List<String> QUALITY_MARKS = List.of("推荐", "重要", MARK_TOP);

    /**
     * 总结报告的生成方式（需求 12.6）。
     *
     * <p>自动生成的内容一经编辑就转成「手动编辑」，让读报告的人知道眼前的数字还是不是系统口径。
     */
    public static final String GENERATE_AUTO = "系统自动生成";
    public static final String GENERATE_MANUAL = "手动编辑";
    public static final List<String> GENERATE_MODES = List.of(GENERATE_AUTO, GENERATE_MANUAL);

    /**
     * 看板卡片流的排序方式（需求 12.7「排序筛选」四选一）。
     *
     * <p>「推荐」不是一个算法：一期没有推荐模型（那属于二期的案例价值评估，N11）。它的口径是
     * <b>精品标注优先、其次最新</b>——把线下评审已经认定为精品／重要／推荐的案例排在前面，
     * 这是平台此刻掌握的唯一「值得看」的信号。不编一个热度公式出来，是因为浏览与点赞在共享
     * 账号下只表示「被打开了多少次」，拿它排序会让一个被反复刷新的案例长期霸榜。
     */
    public static final String SORT_RECOMMENDED = "推荐";
    public static final String SORT_LATEST = "最新";
    public static final String SORT_MOST_LIKED = "最多点赞";
    public static final String SORT_MOST_COMMENTED = "最多评论";
    public static final List<String> BOARD_SORTS =
            List.of(SORT_RECOMMENDED, SORT_LATEST, SORT_MOST_LIKED, SORT_MOST_COMMENTED);

    /** 审核结论 → 案例状态机的动作码（需求 5.9 后两行）。同 {@code CourseEnums} 的同类映射。 */
    public static String auditActionOf(String reviewResult) {
        return switch (reviewResult) {
            case AUDIT_PASS -> com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines
                    .ACTION_AUDIT_PASS;
            case AUDIT_REJECT -> com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines
                    .ACTION_AUDIT_REJECT;
            default -> throw new IllegalArgumentException("未知的审核结论：" + reviewResult);
        };
    }

    /** 各枚举的对外形态，供 {@code /api/meta/field-enums} 下发（纪律 STK-1）。 */
    public static Map<String, List<String>> forMetaApi() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("案例审核结论", REVIEW_RESULTS);
        map.put("案例精品标注", QUALITY_MARKS);
        map.put("案例看板排序", BOARD_SORTS);
        map.put("总结报告生成方式", GENERATE_MODES);
        return Map.copyOf(map);
    }
}
