package com.aiacademy.business.course.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 课程模块的<b>字段枚举</b>全集（需求第 9 章）。状态枚举不在这里——那些由状态机转换表定义，
 * 经 {@code /api/meta/enums} 下发。
 *
 * <p>集中在一处的理由是纪律 STK-1：<b>前端禁止手写状态值与枚举字符串字面量</b>。这些取值同时是
 * 建表脚本的 CHECK 约束、后端的入参校验、前端的下拉选项，散成三份必然漂移——设计稿已经出现过
 * 8 处状态机里不存在的状态值。这里是后两份的唯一来源，与 CHECK 约束的一致性由
 * {@code FieldEnumConstraintTest} 拿真实 schema 核对。
 */
public final class CourseEnums {

    private CourseEnums() {
    }

    /** 需求 9.3.1 第 3 项。由线下评审会判定后录入，<b>允许中途修改</b>（议题 8），系统不做任何判定规则。 */
    public static final String TRACK_INTERNAL = "内部端到端课程";
    public static final String TRACK_PERIPHERAL = "周边领域课程";
    public static final List<String> REVIEW_TRACKS = List.of(TRACK_INTERNAL, TRACK_PERIPHERAL);

    /** 需求 9.3.1 第 12a 项。<b>取值含空格</b>，与建表脚本的 CHECK 约束逐字一致。 */
    public static final String VALIDITY_PERMANENT = "长期有效";
    public static final List<String> VALIDITY_PERIODS =
            List.of("3 个月", "6 个月", "12 个月", VALIDITY_PERMANENT);

    /** 需求 9.3.1a 派生出的有效期状态，同时是列表筛选项（9.10）与前端 StatusTag 的取值。 */
    public static final String VALIDITY_STATUS_UNPUBLISHED = "未发布";
    public static final String VALIDITY_STATUS_PERMANENT = VALIDITY_PERMANENT;
    public static final String VALIDITY_STATUS_VALID = "有效";
    public static final String VALIDITY_STATUS_EXPIRING = "30 天内到期";
    public static final String VALIDITY_STATUS_EXPIRED = "已过期";
    public static final List<String> VALIDITY_STATUSES = List.of(
            VALIDITY_STATUS_VALID, VALIDITY_STATUS_EXPIRING, VALIDITY_STATUS_EXPIRED,
            VALIDITY_STATUS_PERMANENT, VALIDITY_STATUS_UNPUBLISHED);

    /** 需求 9.3.2 第 19 项。多选，由线下评审决定后标注（议题 26）。 */
    public static final List<String> QUALITY_MARKS = List.of("推荐", "重要", "精品");

    /** 开发页「是否进入课程自检」。只留痕，不写开发状态。 */
    public static final List<String> YES_NO = List.of("是", "否");

    /** 评审页手选轮数。与自动建档的 {@code round_no} 分开。 */
    public static final List<String> REVIEW_ROUND_LABELS =
            List.of("第 1 轮", "第 2 轮", "第 3 轮", "第 4 轮", "第 5 轮");

    /** 需求 9.3.3。三类材料都支持多附件。 */
    public static final String MATERIAL_COURSEWARE = "课件";
    public static final String MATERIAL_LESSON_PLAN = "教案";
    public static final String MATERIAL_LAB = "实验材料";
    public static final List<String> MATERIAL_TYPES =
            List.of(MATERIAL_COURSEWARE, MATERIAL_LESSON_PLAN, MATERIAL_LAB);

    /** 材料版本台账状态。不是状态机，不写流转日志。 */
    public static final String VERSION_STATUS_CURRENT = "生效版本";
    public static final String VERSION_STATUS_ARCHIVED = "历史归档";
    public static final String VERSION_STATUS_DEPRECATED = "废弃版本";
    public static final List<String> VERSION_STATUSES =
            List.of(VERSION_STATUS_CURRENT, VERSION_STATUS_ARCHIVED, VERSION_STATUS_DEPRECATED);

    /**
     * 材料类型 → {@code sys_attachment_ref.ref_field}。
     *
     * <p><b>课程材料除了写自己的明细表，还必须在通用引用表登记一条。</b>孤儿附件清理
     * （{@code AttachmentMapper.findOrphans}）只认 {@code sys_attachment_ref}，漏登记的后果不是
     * 报错，是课件在上传满 24 小时后被<b>物理删除</b>，而明细表里那一行还在——页面上表现为
     * 「有这个文件但下不下来」。
     */
    public static String materialRefField(String materialType) {
        return switch (materialType) {
            case MATERIAL_COURSEWARE -> "courseware";
            case MATERIAL_LESSON_PLAN -> "lesson_plan";
            case MATERIAL_LAB -> "lab_material";
            default -> throw new IllegalArgumentException("未知的材料类型：" + materialType);
        };
    }

    /**
     * 材料类型 → 附件场景码（规则 F1 的大小分档）。
     *
     * <p>返回字符串码而不是 {@code AttachmentScene}：这张表要经 {@code /api/meta/material-types}
     * 下发给前端的上传组件，前端据此决定单文件上限，<b>不在前端抄一份「课件 200MB、教案 20MB」</b>。
     * 抄的那份不会随规则 F1 的调整一起改，症状是「界面允许传、保存时被拒」。
     */
    public static String materialScene(String materialType) {
        return switch (materialType) {
            case MATERIAL_COURSEWARE -> "COURSEWARE";
            case MATERIAL_LAB -> "LAB_MATERIAL";
            default -> "GENERAL";
        };
    }

    /**
     * 版本快照持有的附件引用字段（规则 R7）。
     *
     * <p>当前材料被移除后，历史版本仍指向同一个附件行。快照不单独登记引用的话，移除动作会解掉
     * 最后一条引用，清理任务随后把文件物理删除——一年前的评审记录点开材料就是 404，而 R7 要的
     * 恰恰是「历史评审记录永远指向当时的材料」。
     */
    public static String versionRefField(long versionId) {
        return "material_version_" + versionId;
    }

    /** 需求 9.6.1 第 5 项，多选。 */
    public static final List<String> REVIEW_FORMS =
            List.of("线上会议", "线下会议", "邮件", "WeLink", "单独评审", "集体评审");

    /** 需求 9.6.1 第 8 项。驱动课程主状态转换（需求 5.5），对应关系见 {@link #mainStateActionOfReviewResult}。 */
    public static final String REVIEW_PASS = "通过";
    public static final String REVIEW_REJECT_REVISE = "不通过·修改后重新评审";
    public static final String REVIEW_REJECT_CLOSE = "不通过·关闭课程开发";
    public static final List<String> REVIEW_RESULTS =
            List.of(REVIEW_PASS, REVIEW_REJECT_REVISE, REVIEW_REJECT_CLOSE);

    /** 需求 9.7.1 第 8／9 项。课程结论与讲师结论各取一次，互不影响（议题 17）。 */
    public static final String CONCLUSION_QUALIFIED = "合格";
    public static final String CONCLUSION_UNQUALIFIED = "不合格";
    public static final List<String> TRIAL_CONCLUSIONS =
            List.of(CONCLUSION_QUALIFIED, CONCLUSION_UNQUALIFIED);

    /**
     * 需求 9.7.2 试讲验收标准，<b>按评审轨道动态展示</b>。
     *
     * <p>仅作勾选记录，<b>不做「必须全部勾选才能判合格」的校验</b>——结论由线下验收评审会给出，
     * 系统只录入。加了校验会拦住运营录入历史数据（规则 C2）。
     */
    public static final Map<String, List<String>> ACCEPTANCE_CHECKS = acceptanceChecks();

    private static Map<String, List<String>> acceptanceChecks() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put(TRACK_INTERNAL,
                List.of("内容易理解", "节奏适当", "操作可跟上", "学员有产出", "值得推广"));
        map.put(TRACK_PERIPHERAL,
                List.of("解决预定业务问题", "学员能直接使用", "提升效率或质量", "值得推广"));
        return Map.copyOf(map);
    }

    /**
     * 评审结果 → 课程主状态机的动作码（需求 5.5 的「评审结论取值」表）。
     *
     * <p><b>这是本模块唯一一处「业务取值决定状态动作」的映射，且它就是需求表格本身。</b>
     * 不写成 if-else 是为了让「录入结论后课程去哪个状态」保持成一张可以逐行对照需求的表；
     * 散成 if-else 之后，新增一个结论取值时漏改一个分支不会有任何提示。
     */
    public static String mainStateActionOfReviewResult(String reviewResult) {
        return switch (reviewResult) {
            case REVIEW_PASS -> "REVIEW_PASS";
            case REVIEW_REJECT_REVISE -> "REVIEW_REJECT_REVISE";
            case REVIEW_REJECT_CLOSE -> "REVIEW_REJECT_CLOSE";
            default -> throw new IllegalArgumentException("未知的评审结果：" + reviewResult);
        };
    }

    /** 课程试讲结论 → 课程主状态机与试讲子状态机共用的动作码（需求 5.3.1 第 9／10 条、5.4.3）。 */
    public static String trialActionOfCourseConclusion(String courseConclusion) {
        return switch (courseConclusion) {
            case CONCLUSION_QUALIFIED -> "TRIAL_COURSE_PASS";
            case CONCLUSION_UNQUALIFIED -> "TRIAL_COURSE_FAIL";
            default -> throw new IllegalArgumentException("未知的试讲结论：" + courseConclusion);
        };
    }

    /** 各枚举的对外形态，供 {@code /api/meta/field-enums} 下发（纪律 STK-1）。 */
    public static Map<String, List<String>> forMetaApi() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("课程评审轨道", REVIEW_TRACKS);
        map.put("课程有效期", VALIDITY_PERIODS);
        map.put("课程有效期状态", VALIDITY_STATUSES);
        map.put("课程精品标注", QUALITY_MARKS);
        map.put("课程材料类型", MATERIAL_TYPES);
        map.put("课程版本状态", VERSION_STATUSES);
        map.put("是否进入课程自检", YES_NO);
        map.put("是否提交专家评审", YES_NO);
        map.put("是否符合要求", YES_NO);
        map.put("课程评审轮数", REVIEW_ROUND_LABELS);
        map.put("是否进入试讲环节", YES_NO);
        map.put("是否进入上会评审环节", YES_NO);
        map.put("课程是否满足发布要求", YES_NO);
        map.put("讲师试讲是否合格", YES_NO);
        map.put("课程评审形式", REVIEW_FORMS);
        map.put("课程评审结果", REVIEW_RESULTS);
        map.put("试讲结论", TRIAL_CONCLUSIONS);
        ACCEPTANCE_CHECKS.forEach((track, items) -> map.put("试讲验收标准·" + track, items));
        return Map.copyOf(map);
    }
}
