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

    /** 讲师等级（业务确认的建档口径）。 */
    public static final List<String> LEVELS = List.of("L0", "L1", "L2", "L3", "L4");

    /** 上岗状态。新建表单用这一列；「可上岗」与培养状态同名，保存时两列对齐。 */
    public static final String DUTY_READY = "可上岗";
    public static final String DUTY_PAUSED = "暂停授课";
    public static final String DUTY_OFFLINE = "已下线";

    public static final List<String> DUTY_STATES = List.of(DUTY_READY, DUTY_PAUSED, DUTY_OFFLINE);

    /**
     * 培养计划上的类型与状态。与档案培养状态不是同一列：档案三值服务排课，
     * 这里第三值是「已完成培养」，改值不写流转日志。
     */
    public static final List<String> CULTIVATION_TYPES =
            List.of("定向培养", "能力迭代", "专项定向培养", "其他");

    public static final String PLAN_PENDING = "待培养";
    public static final String PLAN_IN_PROGRESS = "培养中";
    public static final String PLAN_DONE = "已完成培养";

    public static final List<String> PLAN_STATES = List.of(PLAN_PENDING, PLAN_IN_PROGRESS, PLAN_DONE);

    /**
     * 认证记录上的状态。只挂在认证台账上，不写进讲师档案、也不进卡片推导
     * （卡上的认证三值仍由试讲合格与培养状态推出）。
     */
    public static final List<String> CERT_STATES = List.of("待认证", "认证中", "已认证");

    /**
     * 卡片上的认证展示。不落库：试讲合格→已认证，培养中且未合格→认证中，其余→待认证。
     * 认证记录上的状态另挂台账，两条线不自动同步。
     */
    public static String certDisplayOf(boolean trialQualified, String trainingState) {
        if (trialQualified) {
            return CERT_STATES.get(2);
        }
        if (TRAINING_IN_PROGRESS.equals(trainingState)) {
            return CERT_STATES.get(1);
        }
        return CERT_STATES.get(0);
    }

    /**
     * 上岗状态 → 培养状态。排课校验一仍读培养状态，所以保存时必须同步，
     * 否则表单改了上岗、排课下拉还按旧的培养状态过滤。
     */
    public static String trainingStateOf(String dutyState) {
        if (DUTY_READY.equals(dutyState)) {
            return TRAINING_QUALIFIED;
        }
        if (DUTY_OFFLINE.equals(dutyState)) {
            return TRAINING_PENDING;
        }
        return TRAINING_IN_PROGRESS;
    }

    /** 培养状态 → 上岗状态。旧接口只传培养状态时补一列，避免 duty_state 落成默认「暂停授课」。 */
    public static String dutyStateOf(String trainingState) {
        return TRAINING_QUALIFIED.equals(trainingState) ? DUTY_READY : DUTY_PAUSED;
    }

    /** 各枚举的对外形态，供 {@code /api/meta/field-enums} 下发（纪律 STK-1）。 */
    public static Map<String, List<String>> forMetaApi() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("讲师培养状态", TRAINING_STATES);
        map.put("讲师在池状态", POOL_STATES);
        map.put("讲师入池方式", JOIN_TYPES);
        map.put("讲师等级", LEVELS);
        map.put("讲师上岗状态", DUTY_STATES);
        map.put("讲师培养类型", CULTIVATION_TYPES);
        map.put("讲师培养计划状态", PLAN_STATES);
        map.put("讲师认证状态", CERT_STATES);
        return Map.copyOf(map);
    }

    private LecturerEnums() {
    }
}
