package com.aiacademy.business.lecturer.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 讲师域的固定枚举取值（需求 10.3）。
 *
 * <p><b>培养状态不是状态机</b>（规则 C10、TS1、TS2）：它是可自由选择的枚举字段，变更不写状态
 * 流转日志，也不参与任何效率指标。写成状态机会让「把讲师从可上岗改回培养中」这种纯粹的信息
 * 修正污染流转统计。
 *
 * <p>「可上岗」是<b>排课的硬性前置条件</b>（规则 TS4、需求 11.4.1 校验一）——这是它唯一参与
 * 判断的地方。培训模块引用的就是这个常量。
 */
public final class LecturerEnums {

    /** 培养状态（需求 10.3.1）。导入时留空按「待培养」处理（需求 14.5 F 列）。 */
    public static final String TRAINING_PENDING = "待培养";
    public static final String TRAINING_IN_PROGRESS = "培养中";
    public static final String TRAINING_QUALIFIED = "可上岗";

    public static final List<String> TRAINING_STATES =
            List.of(TRAINING_PENDING, TRAINING_IN_PROGRESS, TRAINING_QUALIFIED);

    /** 在池状态（需求 10.3.1）。 */
    public static final String POOL_IN = "在池";
    public static final String POOL_OUT = "已移出";

    public static final List<String> POOL_STATES = List.of(POOL_IN, POOL_OUT);

    /**
     * 入池方式（需求 10.4）。三个值各对应一条入池路径，<b>不是可填字段</b>——
     * 由走哪条路径决定，见 {@code LecturerService}。
     */
    public static final String JOIN_AUTO_COURSE_OWNER = "课程开发人员自动入池";
    public static final String JOIN_MANUAL = "运营手动添加";
    public static final String JOIN_IMPORT = "批量导入";

    public static final List<String> JOIN_TYPES =
            List.of(JOIN_AUTO_COURSE_OWNER, JOIN_MANUAL, JOIN_IMPORT);

    /** 各枚举的对外形态，供 {@code /api/meta/field-enums} 下发（纪律 STK-1）。 */
    public static Map<String, List<String>> forMetaApi() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("讲师培养状态", TRAINING_STATES);
        map.put("讲师在池状态", POOL_STATES);
        map.put("讲师入池方式", JOIN_TYPES);
        return Map.copyOf(map);
    }

    private LecturerEnums() {
    }
}
