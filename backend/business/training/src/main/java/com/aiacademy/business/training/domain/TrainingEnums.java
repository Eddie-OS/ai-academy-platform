package com.aiacademy.business.training.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 培训域的固定枚举取值（需求 11.4、11.5、11.7）。
 *
 * <p><b>这里没有一个状态值。</b>培训计划状态与培训场次状态由状态机定义
 * （{@code TrainingStateMachines}），业务代码要引用状态一律回那边取——出口准则 E2-6 的门禁
 * 也按这条对账。本类装的是「培训形式」「签到状态」这类<b>不属于任何状态机</b>的普通枚举列，
 * 它们与状态列的区别是：改动不写状态流转日志，也不影响任何效率指标。
 *
 * <p>取值与建表脚本的 CHECK 约束一一对应，{@code FieldEnumConstraintTest} 会逐条对账。
 */
public final class TrainingEnums {

    /** 培训形式（需求 11.4 第 9 项）。V1.2 确认按这 3 值实现。 */
    public static final String FORM_OFFLINE = "线下";
    public static final String FORM_ONLINE = "线上";
    public static final String FORM_HYBRID = "混合";

    public static final List<String> FORMS = List.of(FORM_OFFLINE, FORM_ONLINE, FORM_HYBRID);

    /** 签到状态（需求 11.5.2）。<b>仅两值</b>：一期不区分迟到／早退／请假／缺席。 */
    public static final String ATTEND_PRESENT = "已签到";
    public static final String ATTEND_ABSENT = "未签到";

    public static final List<String> ATTEND_STATUSES = List.of(ATTEND_PRESENT, ATTEND_ABSENT);

    /** 参训名单的加入方式（需求 11.5.1）。 */
    public static final String JOIN_ASSIGNED = "运营指派";
    public static final String JOIN_BY_ATTENDANCE_IMPORT = "随签到导入自动加入";

    public static final List<String> JOIN_SOURCES = List.of(JOIN_ASSIGNED, JOIN_BY_ATTENDANCE_IMPORT);

    /**
     * 反馈场景（需求 11.7.2 第 7 项）。一期只有一个取值，但它<b>必须出现在每一条按评分聚合的
     * WHERE 里</b>（规则 R9、R10）：试讲反馈与正式授课反馈同表不同口径，混起来算出的平均分
     * 只是低得没有道理，不会报任何错（需求 15.3 结尾的警告）。
     *
     * <p>一个取值的枚举看起来多余，但它的用途不是给下拉框选，是让那条 WHERE 有个可引用的常量
     * ——散在各处的 {@code '正式授课'} 字面量在二期加入第二种场景时会漏改。
     */
    public static final String SCENE_FORMAL = "正式授课";

    public static final List<String> FEEDBACK_SCENES = List.of(SCENE_FORMAL);

    private TrainingEnums() {
    }

    /**
     * 下发给前端的字段枚举（开发 7.5）。键与需求文档的字段名逐字对齐，方便人工对账。
     *
     * <p>后两条下发的是<b>条件必填的适用范围</b>而不是取值表：表单要在选「线下」时把培训地点
     * 标成必填，判断依据只能来自后端，否则前端就得写死「线下」「混合」两个词（纪律 STK-1）。
     * 校验本身照常在 {@code TrainingSessionService} 执行，这里只让界面提前把星号标出来。
     */
    public static Map<String, List<String>> forMetaApi() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("培训形式", FORMS);
        map.put("签到状态", ATTEND_STATUSES);
        map.put("参训加入方式", JOIN_SOURCES);
        map.put("反馈场景", FEEDBACK_SCENES);
        map.put("培训形式·需填培训地点", FORMS.stream().filter(TrainingEnums::needsVenue).toList());
        map.put("培训形式·需填线上链接", FORMS.stream().filter(TrainingEnums::needsOnlineLink).toList());
        return Map.copyOf(map);
    }

    /** 线下与混合要填培训地点（需求 11.4 第 10 项）。 */
    public static boolean needsVenue(String trainingForm) {
        return FORM_OFFLINE.equals(trainingForm) || FORM_HYBRID.equals(trainingForm);
    }

    /** 线上与混合要填线上链接（需求 11.4 第 11 项）。一期为手工填写（N16）。 */
    public static boolean needsOnlineLink(String trainingForm) {
        return FORM_ONLINE.equals(trainingForm) || FORM_HYBRID.equals(trainingForm);
    }
}
