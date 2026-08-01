package com.aiacademy.platform.statemachine.domain;

/**
 * 副作用码。需求文档第 5 章转换表的「系统副作用」列<b>不是注释，是必须实现的行为</b>
 * （《开发实施文档》5.1.5）。
 *
 * <p>这里只声明码值，执行器与各项实现随对应业务模块在阶段 2、3 落地。阶段 1 声明而不实现，
 * 是为了让 16 张转换表一次录全——否则后期补录要把 72 行逐条重读一遍需求文档。
 *
 * <p><b>「写日志」不在此列。</b>规则 C4 让它对每条转换无条件成立，建模成可选副作用反而给了漏写的空间。
 */
public final class Effect {

    private Effect() {
    }

    /**
     * 派生任务，形如 {@code DERIVE_TASK:需求评审}。任务类型用中文与需求 13.1.2 逐字对齐，
     * 便于人工按表对账；这也符合本项目「枚举存中文字符串」的建模约定。
     *
     * <p><b>需求 13.1.2 只列了 8 条派生规则，但转换表要求派生 10 类任务</b>：
     * 5.2.5 的「业务验收」与 5.9 的「案例审核」是 V1.2 依 C06／C09 新增的，13.1.2 没同步补规则，
     * 因此这两类任务的责任人与默认截止天数目前无定义。<b>阶段 3 做任务派生前必须先补齐 13.1.2。</b>
     */
    public static String deriveTask(String taskType) {
        return "DERIVE_TASK:" + taskType;
    }

    /**
     * 置子状态，形如 {@code SET_SUB_STATE:课程开发状态=待开发}。
     * 只有课程有子状态（需求 5.3.2 的 4 组 8 值）。
     */
    public static String setSubState(String stateField, String state) {
        return "SET_SUB_STATE:" + stateField + "=" + state;
    }

    // --- 需求（5.2） -------------------------------------------------------

    /** 5.2.1 第 3 条：录入评审结论时必须同时填写分流出口。 */
    public static final String REQUIRE_OUTLET = "REQUIRE_OUTLET";

    /** 5.2.1 第 5 条：重新评审会清空分流出口，需二次确认。 */
    public static final String CONFIRM_CLEAR_OUTLET = "CONFIRM_CLEAR_OUTLET";

    /** 5.2.5：标记交付使用时写交付时间。 */
    public static final String SET_DELIVERED_AT = "SET_DELIVERED_AT";

    /** 5.2.5：写验收人、验收时间、验收意见。 */
    public static final String RECORD_ACCEPTANCE = "RECORD_ACCEPTANCE";

    /** 5.2.5 第 3 条：验收不通过按出口退回——出口一退到「已输出」，出口二退到「开发中」。 */
    public static final String REVERT_BY_OUTLET = "REVERT_BY_OUTLET";

    /**
     * 验收轮次 +1。
     *
     * <p>这一项<b>不在 5.2.5 的「系统副作用」列里</b>，来源是需求字段清单第 34 项「验收轮次」：
     * 「每次从『验收不通过』重新提交时 +1，用于展示反复验收的次数」。字段清单要求了它，
     * 而转换表漏标，除了挂在这条转换上它没有别的落点。<b>这是本表唯一一条不由第 5 章直接给出的副作用。</b>
     */
    public static final String INCREMENT_ACCEPTANCE_ROUND = "INCREMENT_ACCEPTANCE_ROUND";

    /** 需求归档的前置：业务验收状态必须为「验收通过」。C9 三处例外之一，硬阻断。 */
    public static final String REQUIRE_ACCEPTANCE_PASSED = "REQUIRE_ACCEPTANCE_PASSED";

    /**
     * 5.2.5「前置与终态」第 2 条：归档时写归档时间。
     *
     * <p>交付侧一直有 {@link #SET_DELIVERED_AT}，归档侧却没有对称的码——这是阶段 1 人工验收
     * 逐行对着需求 5.2.5 看时发现的漏项（那张表是 16 张里唯一不进 CSV、机器比不到的一张）。
     *
     * <p>副作用码是给阶段 2 实现方的清单。缺这一个的表现是「归档成功了，但归档时间是空的」：
     * 字段清单第 36 项要求它自动写入，漏写不报任何错，只会在需要按归档时间统计时才暴露。
     */
    public static final String SET_ARCHIVED_AT = "SET_ARCHIVED_AT";

    // --- 课程（5.3～5.6） --------------------------------------------------

    /**
     * 自动快照材料版本。5.3.1 第 4／8 条，是课程模块最容易做错的地方（《开发实施文档》5.1.5）。
     *
     * <p>正确实现是把当前全部材料的<b>元数据</b>复制一份进版本表，对象存储里的文件不复制；
     * 反模式是只在评审记录上记一个版本号、材料仍指向「当前文件」，那样负责人评审后替换课件，
     * 历史评审记录看到的就是新文件，R7 失效。
     */
    public static final String SNAPSHOT_MATERIAL = "SNAPSHOT_MATERIAL";

    /** 5.3.1 第 4／8 条：创建评审记录，轮次 +1。 */
    public static final String CREATE_REVIEW_ROUND = "CREATE_REVIEW_ROUND";

    /** 5.3.1 第 7／15 条：关闭全部关联任务。另见 13.1.2 的自动关闭规则。 */
    public static final String CLOSE_RELATED_TASKS = "CLOSE_RELATED_TASKS";

    /** 5.3.1 第 9 条：首次进入「发布」时写首次发布时间，并按有效期计算到期日（需求 9.3）。 */
    public static final String SET_FIRST_PUBLISHED_AT = "SET_FIRST_PUBLISHED_AT";

    /** 5.3.1 第 12 条：自动创建案例记录，初始状态「待整理」。 */
    public static final String CREATE_CASE = "CREATE_CASE";

    /** 5.5／5.6 第 1 条：轮次号 = 该课程已有记录数 + 1。 */
    public static final String SET_ROUND_NO = "SET_ROUND_NO";

    /** 5.5 第 1 条：评审记录绑定提交时的材料版本号（R7）。 */
    public static final String BIND_MATERIAL_VERSION = "BIND_MATERIAL_VERSION";

    /** 5.5／5.6 第 2 条：记录结论驱动课程主状态转换。 */
    public static final String DRIVE_COURSE_MAIN_STATE = "DRIVE_COURSE_MAIN_STATE";

    /** 5.6 第 2 条：按讲师试讲结论更新讲师试讲合格标记，并在双结论不一致时置标记。 */
    public static final String UPDATE_LECTURER_TRIAL_FLAG = "UPDATE_LECTURER_TRIAL_FLAG";

    // --- 培训（5.7～5.8） --------------------------------------------------

    /** 5.7 第 3 条：首次进入「已完成」时写实际完成时间。退回再进入时不覆盖。 */
    public static final String SET_ACTUAL_FINISHED_AT = "SET_ACTUAL_FINISHED_AT";

    /** 5.8 第 1 条：场次挂到指定培训计划下。 */
    public static final String ATTACH_TO_PLAN = "ATTACH_TO_PLAN";

    /** 5.8 第 1 条：执行排课三项校验（需求 11.4）。C9 三处例外之一。 */
    public static final String VALIDATE_SCHEDULING = "VALIDATE_SCHEDULING";

    // --- 案例（5.9） ------------------------------------------------------

    /** 5.9：写审核人、审核时间、审核意见。案例审核不记轮次，后一次覆盖前一次。 */
    public static final String RECORD_CASE_AUDIT = "RECORD_CASE_AUDIT";

    /** 5.9 第 4 条：审核通过时写入上架时间。 */
    public static final String SET_CASE_PUBLISHED_AT = "SET_CASE_PUBLISHED_AT";
}
