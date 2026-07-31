package com.aiacademy.app.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 建库脚本对《开发实施文档》第 6 章命名与字段约定的符合性断言。
 *
 * <p>这些规则原本只写在文档里，靠人工评审 43 张表是否都遵守了。本类把它们变成断言，理由与
 * 阶段 1A 把需求第 5 章的转换表变成参数化测试相同：AI 一次生成 43 张表时，错漏是**系统性的**
 * （比如某一类表整体漏了公共字段），人工抽查恰好最难发现系统性错误。
 *
 * <p>每条断言都指向文档条目号。断言失败时先看文档那一条，不要直接改断言迁就脚本。
 */
class SchemaConventionTest {

    /**
     * 开发实施文档 6.2 的 43 张表，加上 6.2.7 表清单未列而附件功能必需的 sys_attachment_ref。
     *
     * <p>其中两处与 6.2 的分组不同，理由见对应迁移脚本的表头注释：
     * dtl_course_acceptance 更正为 dtl_demand_acceptance 并移入需求模块（需求 4→5、课程 10→9）。
     */
    private static final Set<String> EXPECTED_TABLES = new TreeSet<>(Set.of(
            // 人员 2（6.2.1）
            "org_employee", "sys_login_log",
            // AI需求 5（6.2.2 的 4 张 + 更正归属的业务验收记录）
            "biz_demand", "dtl_demand_review", "dtl_demand_acceptance", "rel_demand_course", "biz_value_report",
            // 课程 9（6.2.3 的 10 张减去移走的业务验收记录）
            "biz_course", "dtl_course_material", "dtl_course_material_version",
            "dtl_course_material_version_file", "dtl_course_review", "dtl_course_trial",
            "dtl_trial_feedback", "dtl_course_selfcheck", "dtl_course_schedule",
            // 讲师 3（6.2.4）
            "biz_lecturer", "dtl_teaching_record", "dtl_student_evaluation",
            // 培训 7（6.2.5）
            "biz_training_plan", "biz_training_session", "dtl_session_attendee", "dtl_attendance",
            "dtl_training_archive", "dtl_training_feedback", "dtl_feedback_incentive",
            // 案例 5（6.2.6）
            "biz_case", "dtl_case_view", "dtl_case_like", "dtl_case_comment", "dtl_case_report",
            // 平台 12（6.2.7）
            "audit_state_log", "audit_op_log", "sys_task", "dtl_escalation_record", "sys_attachment",
            "import_batch", "import_row_snapshot", "snapshot_warning_light", "dict_item",
            "cfg_warning_threshold", "cfg_task_derive_rule", "cfg_selfcheck_item",
            // 表清单未列，附件多引用与孤儿清理必需（见 V1_001 的表头注释）
            "sys_attachment_ref"));

    /**
     * 阶段 0 的骨架示例表，不属于业务表清单，因此下面几处断言把它排除在外。
     *
     * <p><b>删除时点定在 1C</b>（原计划 1B 末）：它目前是全项目唯一的写接口，E0 冒烟测试靠它验
     * 「未登录 401 / 查看账号写入 403 / 统一响应格式与 traceId」共 7 项断言。1B 末删掉的话，
     * 这些断言在 1C 期间只能对着占位接口打空转；而 1C 的导入中心会带来第一个真实写接口，
     * 到那时把冒烟测试改指到它、同一次提交里 DROP 本表，不产生任何过渡代码。
     *
     * <p>删除时要一并去掉下面三处 {@code actual.remove(SKELETON_TABLE)}——留着它们等于永久允许
     * 一张叫这个名字的表带 version 列而不被规则 K1 拦住。
     */
    private static final String SKELETON_TABLE = "sys_skeleton_sample";

    /**
     * 公共字段模板（6.1.2）的豁免表及理由。
     *
     * <p>豁免不是「忘了加」，每一条都要说得出为什么。给追加写的日志表加 deleted 列，等于给
     * 「删审计记录」提供入口，而需求 5.11 要求状态流转日志永不删除。
     */
    private static final Set<String> COMMON_FIELD_EXEMPT = Set.of(
            "audit_state_log",          // 追加写、永不删除（需求 5.11）
            "audit_op_log",             // 同上（需求 5.12）
            "sys_login_log",            // 追加写、永不删除
            "dtl_case_view",            // PV 流水，无更新与删除路径（需求 12.4 不去重）
            "dtl_case_like",            // 点赞流水，不去重、不可取消（需求 12.3 第 18 项）
            "import_row_snapshot",      // 撤销依据，追加写
            "snapshot_warning_light",   // 每个对象一行、每日整行覆盖（开发 5.4.2）
            "rel_demand_course");       // 解除关联即物理删除，变更由 audit_op_log 留痕（开发 6.3.1）

    /** 规则 K1：乐观锁只加在需求、课程、案例三类主对象上。 */
    private static final Set<String> OPTIMISTIC_LOCK_TABLES = Set.of("biz_demand", "biz_course", "biz_case");

    /**
     * 有状态机的对象表，都必须有 last_state_changed_at。
     *
     * <p>这个集合与 1A 注册的 16 个状态机的 objectType 一一对应（DEMAND、COURSE、COURSE_REVIEW、
     * COURSE_TRIAL、TRAINING_PLAN、TRAINING_SESSION、CASE、TASK 共 8 类对象）。
     *
     * <p>6.1.2 的原文是「五类带状态的主对象额外包含」，但出口准则 E1-2 要求的是「**任意**状态变更
     * 均自动产生流转日志，且 last_state_changed_at 被更新」。评审记录、试讲记录、任务这三类
     * 也有状态机，按 E1-2 的字面要求它们同样需要这一列，否则状态机引擎在这些对象上无处写。
     */
    private static final Set<String> STATE_MACHINE_TABLES = Set.of(
            "biz_demand", "biz_course", "dtl_course_review", "dtl_course_trial",
            "biz_training_plan", "biz_training_session", "biz_case", "sys_task");

    @Test
    @DisplayName("6.2 表清单的每张表都已建出，且没有建多余的表")
    void 表清单与实际建表一致() {
        Set<String> actual = new TreeSet<>(MigratedSchema.tableNames());
        actual.remove(SKELETON_TABLE);

        assertThat(actual)
                .describedAs("与开发实施文档 6.2 表清单的差异（多出或缺少）")
                .containsExactlyInAnyOrderElementsOf(EXPECTED_TABLES);
    }

    @Test
    @DisplayName("6.1.2 公共字段模板：非豁免表必须五个字段齐全")
    void 公共字段模板齐全() {
        List<String> violations = MigratedSchema.tableNames().stream()
                .filter(table -> !COMMON_FIELD_EXEMPT.contains(table))
                .flatMap(table -> Set.of("created_at", "created_by", "updated_at", "updated_by", "deleted").stream()
                        .filter(column -> !MigratedSchema.hasColumn(table, column))
                        .map(column -> table + " 缺 " + column))
                .sorted()
                .toList();

        assertThat(violations)
                .describedAs("缺公共字段的表。要么补齐，要么在 COMMON_FIELD_EXEMPT 里写明豁免理由")
                .isEmpty();
    }

    @Test
    @DisplayName("有 deleted 列的表必须有 updated_at 与 updated_by —— 逻辑删除本身就是一次更新")
    void 逻辑删除表必须能记录更新人() {
        List<String> violations = MigratedSchema.tableNames().stream()
                .filter(table -> MigratedSchema.hasColumn(table, "deleted"))
                .filter(table -> !MigratedSchema.hasColumn(table, "updated_at")
                        || !MigratedSchema.hasColumn(table, "updated_by"))
                .sorted()
                .toList();

        assertThat(violations)
                .describedAs("这些表能被逻辑删除，却记不下是谁在什么时候删的")
                .isEmpty();
    }

    @Test
    @DisplayName("规则 K1：version 列只许出现在需求、课程、案例三张表上")
    void 乐观锁范围不得扩大() {
        Set<String> actual = new TreeSet<>(MigratedSchema.tablesHavingColumn("version"));
        actual.remove(SKELETON_TABLE);

        assertThat(actual)
                .describedAs("给全部表加 version 会让导入与批量写入的实现复杂化且收益为零（开发 5.10）")
                .containsExactlyInAnyOrderElementsOf(OPTIMISTIC_LOCK_TABLES);
    }

    @Test
    @DisplayName("出口准则 E1-2：每个有状态机的对象表都有 last_state_changed_at")
    void 有状态机的表都能记录状态变更时间() {
        Set<String> actual = new TreeSet<>(MigratedSchema.tablesHavingColumn("last_state_changed_at"));
        actual.remove(SKELETON_TABLE);

        assertThat(actual)
                .describedAs("状态机引擎在这些对象上要更新 last_state_changed_at，缺列则 E1-2 无法满足")
                .containsExactlyInAnyOrderElementsOf(STATE_MACHINE_TABLES);
    }

    @Test
    @DisplayName("需求 C6 / L1：updated_at 与 last_state_changed_at 必须是两个独立字段")
    void 编辑时间与状态变更时间不得合并() {
        List<String> violations = STATE_MACHINE_TABLES.stream()
                .filter(table -> !MigratedSchema.hasColumn(table, "updated_at"))
                .sorted()
                .toList();

        assertThat(violations)
                .describedAs("这是全库最容易被「优化」掉的两个字段。一旦合并，停滞预警与 9 个效率指标整体失效（6.1.2）")
                .isEmpty();
    }

    @Test
    @DisplayName("6.1.4：时间字段统一 TIMESTAMPTZ，不得出现不带时区的 timestamp")
    void 时间字段一律带时区() {
        // flyway_schema_history 的 installed_on 是 Flyway 自己建的、不带时区的，不受本项目建表规范约束。
        List<String> violations = MigratedSchema.query("""
                SELECT table_name || '.' || column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND data_type = 'timestamp without time zone'
                  AND table_name <> 'flyway_schema_history'
                ORDER BY 1
                """);

        assertThat(violations)
                .describedAs("纯日期语义的字段应当用 DATE，其余一律 TIMESTAMPTZ。混用会让「剩余天数」出现 ±1 天偏差（6.1.4）")
                .isEmpty();
    }

    @Test
    @DisplayName("6.1.4：三色灯判定基准的「预计完成时间」必须是 DATE，不能带时分秒")
    void 三色灯基准字段是纯日期() {
        assertThat(MigratedSchema.dataTypeOf("biz_demand", "expect_finish_date")).isEqualTo("date");
        assertThat(MigratedSchema.dataTypeOf("biz_course", "expect_publish_date")).isEqualTo("date");
        assertThat(MigratedSchema.dataTypeOf("biz_training_plan", "plan_end_date")).isEqualTo("date");
        assertThat(MigratedSchema.dataTypeOf("biz_case", "expect_publish_date")).isEqualTo("date");
    }

    @Test
    @DisplayName("6.1.1：表名前缀只许用规定的八种")
    void 表名前缀合规() {
        Set<String> allowed = Set.of("biz_", "rel_", "dtl_", "org_", "audit_", "cfg_", "dict_", "sys_");
        List<String> violations = MigratedSchema.tableNames().stream()
                .filter(table -> allowed.stream().noneMatch(table::startsWith))
                .sorted()
                .toList();

        assertThat(violations)
                .describedAs("""
                        6.1.1 只允许八种前缀。当前的例外是灯色快照与导入两组表：
                        snapshot_warning_light、import_batch、import_row_snapshot 沿用开发 6.2.7 表清单的
                        原名，三者都不合前缀规范。已记入待修文档清单，改名需要同时改文档，不在本阶段做。""")
                .containsExactlyInAnyOrder("snapshot_warning_light", "import_batch", "import_row_snapshot");
    }

    @Test
    @DisplayName("开发 6.3.4：试讲结论不一致标记是生成列，不由应用层维护")
    void 结论不一致标记是生成列() {
        List<String> generated = MigratedSchema.query("""
                SELECT column_name, is_generated
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'dtl_course_trial'
                  AND column_name = 'inconsistent'
                """);

        assertThat(generated)
                .describedAs("用生成列可以保证标记永不与数据脱节，且 13.3.1 的筛选条件可以直接建索引")
                .containsExactly("inconsistent | ALWAYS");
    }

    @Test
    @DisplayName("IX-4：audit_state_log 的两个复合索引存在，且首次到达索引的列顺序正确")
    void 状态流转日志索引符合查询模式() {
        List<String> indexes = MigratedSchema.query("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'audit_state_log'
                ORDER BY indexname
                """);

        assertThat(indexes).anySatisfy(def -> assertThat(def)
                .describedAs("列顺序按需求 15.2 的查询模式设计：先按对象类型 + 状态字段 + 目标状态过滤，再按对象分组取 MIN(changed_at)")
                .contains("idx_state_log_first_arrival")
                .contains("(object_type, state_field, to_state, object_id, changed_at)"));
        assertThat(indexes).anySatisfy(def -> assertThat(def).contains("idx_state_log_object"));
    }

    @Test
    @DisplayName("IX-5：签到记录的场次 + 工号唯一约束存在 —— 它决定导入重复行按更新处理")
    void 签到唯一约束存在() {
        List<String> constraints = MigratedSchema.query("""
                SELECT indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'dtl_attendance' AND indexdef LIKE '%UNIQUE%'
                """);

        assertThat(constraints)
                .describedAs("缺这条约束时，同一场次同一人会插入两条，「场次实际参训人数」直接偏大（开发 6.3.6）")
                .anySatisfy(def -> assertThat(def).contains("(session_id, employee_no)"));
    }

    @Test
    @DisplayName("开发 6.3.5 / 5.10：评审与试讲记录的（对象ID，轮次）唯一约束存在")
    void 轮次唯一约束存在() {
        List<String> reviewUnique = MigratedSchema.query("""
                SELECT indexdef FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'dtl_course_review' AND indexdef LIKE '%UNIQUE%'
                """);
        List<String> trialUnique = MigratedSchema.query("""
                SELECT indexdef FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'dtl_course_trial' AND indexdef LIKE '%UNIQUE%'
                """);

        assertThat(reviewUnique).anySatisfy(def -> assertThat(def).contains("(course_id, round_no)"));
        assertThat(trialUnique).anySatisfy(def -> assertThat(def).contains("(course_id, round_no)"));
    }

    @Test
    @DisplayName("开发 6.3.7：案例与课程 1:1，关系放在案例侧且 course_id 唯一")
    void 案例来源课程唯一() {
        List<String> unique = MigratedSchema.query("""
                SELECT indexdef FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'biz_case' AND indexdef LIKE '%UNIQUE%'
                """);

        assertThat(unique).anySatisfy(def -> assertThat(def).contains("(course_id)"));
    }

    @Test
    @DisplayName("需求 8.3.5 / 13.4.4：实时计算的派生值不得落库")
    void 派生值不建列() {
        // 灯色与停滞天数（需求 8.3.5 S4／S5、13.4.4）
        assertThat(MigratedSchema.tablesHavingColumn("light_color")).isEmpty();
        assertThat(MigratedSchema.tablesHavingColumn("stagnant_days")).isEmpty();
        // 课程过期标记（需求 9.3.1 第 12c 项：实时计算，不落库不建定时任务）
        assertThat(MigratedSchema.hasColumn("biz_course", "expired")).isFalse();
        // 任务逾期标记（需求 13.1.1 第 9 项：派生字段，实时计算，非状态）
        assertThat(MigratedSchema.hasColumn("sys_task", "overdue")).isFalse();

        // snapshot_warning_light 是唯一允许存灯色的地方，且仅用于变化检测（开发 5.4.2）
        assertThat(MigratedSchema.hasColumn("snapshot_warning_light", "light")).isTrue();
    }

    @Test
    @DisplayName("N18 / N19 / N20 / N21：已删除范围的字段与表不得出现")
    void 已删除范围不得复活() {
        assertThat(MigratedSchema.tableNames())
                .describedAs("组织架构整体不做（N18）、无账号表（C04）、无代理（N19）、不发消息（C06）")
                .doesNotContain("org_department", "sys_user", "sys_role_flag", "sys_object_delegate",
                        "sys_message", "sys_message_send_log", "dtl_case_favorite", "dtl_demand_urge");

        // 签到记录的冗余部门编码，V1.1 删除（IX-5、开发 6.3.6）
        assertThat(MigratedSchema.hasColumn("dtl_attendance", "dept_code_snapshot")).isFalse();
        // 出口三取消后「复用工具名称」无用（需求 8.3.3 第 20 项、开发 6.3.2）
        assertThat(MigratedSchema.hasColumn("biz_demand", "reuse_tool_name")).isFalse();
        // 收藏数（需求 12.3 第 20 项，N21）
        assertThat(MigratedSchema.hasColumn("biz_case", "favorite_count")).isFalse();

        // deputy_id 是例外：代理机制删除，但需求 8.3.1 第 7 项明确「数据库保留 deputy_id 列」
        assertThat(MigratedSchema.hasColumn("biz_demand", "deputy_id")).isTrue();
    }

    @Test
    @DisplayName("开发 5.2.4：两张日志表保留 operator_no / operator_name 且可为空，供二期开号")
    void 日志表的二期预留列可为空() {
        List<String> nullability = MigratedSchema.query("""
                SELECT table_name || '.' || column_name || '=' || is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name IN ('audit_state_log', 'audit_op_log')
                  AND column_name IN ('operator_no', 'operator_name')
                ORDER BY 1
                """);

        assertThat(nullability)
                .describedAs("""
                        需求 5.11 明确这两列是二期预留、可为空，本期恒为 NULL；真正记录操作者的是
                        account_type。开发 5.2.2 的示例 DDL 把两列写成 NOT NULL 且没有 account_type，
                        与需求冲突，本项目以需求为准。""")
                .containsExactly(
                        "audit_op_log.operator_name=YES",
                        "audit_op_log.operator_no=YES",
                        "audit_state_log.operator_name=YES",
                        "audit_state_log.operator_no=YES");

        assertThat(MigratedSchema.hasColumn("audit_state_log", "account_type")).isTrue();
        assertThat(MigratedSchema.hasColumn("audit_op_log", "account_type")).isTrue();
        // 需求 5.12 要求操作IP必填 —— 共享账号下这是唯一能区分「从哪台机器操作」的线索
        assertThat(MigratedSchema.dataTypeOf("audit_op_log", "operator_ip")).isNotNull();
    }
}
