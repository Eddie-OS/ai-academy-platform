package com.aiacademy.app.dataimport;

import com.aiacademy.platform.dataimport.domain.ImportPreview;
import com.aiacademy.platform.dataimport.domain.ImportType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 6 类导入各自的业务规则（需求 14.3～14.8）与出口准则 <b>E1-7</b>（匿名反馈）。
 *
 * <p>框架层的通用规则在 {@link ImportFrameworkIntegrationTest}，这里只测「这一类导入与别类不同」的部分：
 * 覆盖还是追加、重复算错还是忽略、有没有连带写第二张表。这些差异是需求逐条写死的，
 * 一旦某一类被顺手抄成另一类的语义，数据会静默地多一份或少一份。
 */
class ImportHandlerIntegrationTest extends ImportTestBase {

    // -------------------------------------------------------------------------
    // 14.3 人员导入
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("14.3：工号不存在则新增、已存在则更新，且更新不新建一条")
    void 人员按工号新增或更新() {
        String no = "E" + System.nanoTime();
        导入(ImportType.PEOPLE, List.of(
                List.of(no, "张三", "客服中心", "工程师", "zhangsan@example.com", "两者", "在职")));

        ImportPreview second = 上传(ImportType.PEOPLE, List.of(
                List.of(no, "张三丰", "AI中心", "高级工程师", "zhangsan@example.com", "讲师", "离职")));
        assertThat(second.insertRows()).isZero();
        assertThat(second.updateRows())
                .describedAs("需求 14.3 A 列：工号是唯一键，第二次导入是更新")
                .isEqualTo(1);
        imports.confirm(second.batchNo());

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM org_employee WHERE employee_no = ?", no);
        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.get("employee_name")).isEqualTo("张三丰");
            assertThat(row.get("dept_name")).isEqualTo("AI中心");
            assertThat(row.get("person_state")).isEqualTo("离职");
        });
    }

    @Test
    @DisplayName("14.3：文件内工号重复直接报错——两行谁覆盖谁没有约定")
    void 人员文件内工号重复报错() {
        String no = "E" + System.nanoTime();
        ImportPreview preview = 上传(ImportType.PEOPLE, List.of(
                List.of(no, "张三", "客服中心", "", "", "两者", "在职"),
                List.of(no, "李四", "AI中心", "", "", "学员", "在职")));

        assertThat(preview.canConfirm()).isFalse();
        assertThat(preview.errors()).singleElement().satisfies(problem -> {
            assertThat(problem.rowNo()).isEqualTo(4);
            assertThat(problem.reason()).contains("重复");
        });
    }

    @Test
    @DisplayName("14.3：改成离职且名下还有在办对象时警告，但不阻断——离职是既成事实")
    void 离职负责人警告() {
        String no = 造人员("张三", "客服中心");
        jdbc.update("""
                INSERT INTO biz_demand (demand_no, demand_name, domain_code, proposer_no, owner_no,
                                        proposed_date, expect_finish_date, description,
                                        review_state, created_by)
                VALUES (?, '他名下的需求', 'AI_DEMAND', ?, ?, CURRENT_DATE, CURRENT_DATE + 10,
                        '离职负责人警告用', '待评审', 'OPS')
                """, "DEMAND" + System.nanoTime(), no, no);

        ImportPreview preview = 上传(ImportType.PEOPLE, List.of(
                List.of(no, "张三", "客服中心", "", "", "两者", "离职")));

        assertThat(preview.canConfirm())
                .describedAs("需求 14.3 G 列：离职是既成事实，平台不能因为「名下有对象」就拒绝录入")
                .isTrue();
        assertThat(preview.warnings()).singleElement().satisfies(problem -> {
            assertThat(problem.column()).isEqualTo("人员状态");
            assertThat(problem.reason())
                    .describedAs("必须告诉运营有几个对象要转交，否则这些对象会在无人负责的状态下继续走流程")
                    .contains("1");
        });
    }

    @Test
    @DisplayName("14.3：名下没有在办对象的人改离职不该报警告（离职警告的反向对照）")
    void 无在办对象的离职不警告() {
        String no = 造人员("李四", "客服中心");

        ImportPreview preview = 上传(ImportType.PEOPLE, List.of(
                List.of(no, "李四", "客服中心", "", "", "两者", "离职")));

        assertThat(preview.warnings())
                .describedAs("对每个离职的人都弹警告，等于让运营学会无视警告")
                .isEmpty();
    }

    // -------------------------------------------------------------------------
    // 14.4 签到导入
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("14.4／A8-6：学员不在参训名单里时自动补名单，并标明是签到导入带进来的")
    void 签到自动补名单() {
        String sessionNo = 造场次("已开课");
        String employeeNo = 造人员("张三", "客服中心");

        String batchNo = 导入(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "张三", "已签到", "2026-08-01 09:05", "线上参加")));

        assertThat(行("dtl_attendance", batchNo)).singleElement().satisfies(row -> {
            assertThat(row.get("employee_no")).isEqualTo(employeeNo);
            assertThat(row.get("attend_status")).isEqualTo("已签到");
            assertThat(row.get("remark")).isEqualTo("线上参加");
            assertThat(列(row, "dept_name_snapshot"))
                    .describedAs("部门是快照：这个人明年调岗后，这场培训的部门分布统计不该跟着变")
                    .isEqualTo("客服中心");
        });
        assertThat(行("dtl_session_attendee", batchNo)).singleElement().satisfies(row ->
                assertThat(row.get("join_source"))
                        .describedAs("验收 A8-6／A8-7：自动补的名单要能被认出来，撤销签到批次时才知道该连它一起回滚")
                        .isEqualTo("随签到导入自动加入"));
    }

    @Test
    @DisplayName("14.4：已在参训名单里的人不重复补名单")
    void 名单已存在时不补() {
        String sessionNo = 造场次("已开课");
        String employeeNo = 造人员("张三", "客服中心");
        导入(ImportType.ATTENDEE, List.of(List.of(sessionNo, employeeNo, "张三")));

        String batchNo = 导入(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "张三", "已签到", "", "")));

        assertThat(行("dtl_session_attendee", batchNo))
                .describedAs("名单是（场次，工号）唯一的，补第二条会直接撞唯一约束整批失败")
                .isEmpty();
        assertThat(计数("SELECT COUNT(*) FROM dtl_session_attendee WHERE session_id = ?",
                场次ID(sessionNo))).isEqualTo(1);
    }

    @Test
    @DisplayName("14.4：签到时间留空取场次开始时间，而不是留空或取当前时间")
    void 签到时间留空取场次开始时间() {
        String sessionNo = 造场次("已开课");
        String employeeNo = 造人员("张三", "客服中心");

        String batchNo = 导入(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "", "已签到", "", "")));

        java.time.OffsetDateTime attendTime = jdbc.queryForObject(
                "SELECT attend_time FROM dtl_attendance WHERE import_batch_no = ?",
                java.time.OffsetDateTime.class, batchNo);
        java.time.OffsetDateTime sessionStart = jdbc.queryForObject("""
                SELECT (training_date + start_time) AT TIME ZONE current_setting('TimeZone')
                  FROM biz_training_session WHERE session_no = ?
                """, java.time.OffsetDateTime.class, sessionNo);
        assertThat(attendTime)
                .describedAs("需求 14.4 E 列。取当前时间会让「按时签到率」这类统计全部失真")
                .isEqualTo(sessionStart);
    }

    @Test
    @DisplayName("14.4：同一场次同一工号重复导入是覆盖更新，不是新增一条")
    void 签到重复导入覆盖更新() {
        String sessionNo = 造场次("已开课");
        String employeeNo = 造人员("张三", "客服中心");
        导入(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "", "未签到", "", "第一次导错了")));

        ImportPreview second = 上传(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "", "已签到", "", "改对了")));
        assertThat(second.updateRows()).isEqualTo(1);
        assertThat(second.insertRows()).isZero();
        imports.confirm(second.batchNo());

        assertThat(jdbc.queryForList(
                "SELECT * FROM dtl_attendance WHERE session_id = ?", 场次ID(sessionNo)))
                .describedAs("签到是覆盖语义（需求 14.4）——两条同人签到会让签到率超过 100%%")
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.get("attend_status")).isEqualTo("已签到");
                    assertThat(row.get("remark")).isEqualTo("改对了");
                });
    }

    @Test
    @DisplayName("14.4：场次还没开课就导签到直接报错")
    void 未开课场次不能导签到() {
        String sessionNo = 造场次("待开课");
        String employeeNo = 造人员("张三", "客服中心");

        ImportPreview preview = 上传(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "", "已签到", "", "")));

        assertThat(preview.canConfirm()).isFalse();
        assertThat(preview.errors()).singleElement().satisfies(problem -> {
            assertThat(problem.column()).isEqualTo("培训场次ID");
            assertThat(problem.reason()).contains("待开课");
        });
    }

    // -------------------------------------------------------------------------
    // 14.8 参训名单导入
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("14.8：重复的名单行忽略而不报错——这一类的重复是「已经在名单里了」，不是错误")
    void 参训名单重复忽略() {
        String sessionNo = 造场次("待开课");
        String a = 造人员("张三", "客服中心");
        String b = 造人员("李四", "客服中心");

        ImportPreview first = 上传(ImportType.ATTENDEE, List.of(
                List.of(sessionNo, a, "张三"),
                List.of(sessionNo, a, "张三"),
                List.of(sessionNo, b, "李四")));
        assertThat(first.insertRows()).isEqualTo(2);
        assertThat(first.skipRows())
                .describedAs("需求 14.8：文件内重复忽略。报错会让运营为了一个无害的重复而重做整个文件")
                .isEqualTo(1);
        assertThat(first.canConfirm()).isTrue();
        imports.confirm(first.batchNo());

        ImportPreview second = 上传(ImportType.ATTENDEE, List.of(List.of(sessionNo, a, "张三")));
        assertThat(second.skipRows())
                .describedAs("库里已存在的同样忽略")
                .isEqualTo(1);
        assertThat(计数("SELECT COUNT(*) FROM dtl_session_attendee WHERE session_id = ?",
                场次ID(sessionNo))).isEqualTo(2);
    }

    @Test
    @DisplayName("14.8：名单导入的加入方式是「运营指派」，与签到自动补入区分")
    void 参训名单加入方式() {
        String sessionNo = 造场次("待开课");
        String batchNo = 导入(ImportType.ATTENDEE, List.of(
                List.of(sessionNo, 造人员("张三", "客服中心"), "张三")));

        assertThat(行("dtl_session_attendee", batchNo)).singleElement()
                .satisfies(row -> assertThat(row.get("join_source")).isEqualTo("运营指派"));
    }

    // -------------------------------------------------------------------------
    // 14.6 学员反馈导入（E1-7）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("E1-7：学员工号留空即匿名，工号、姓名、部门三列一起为 NULL")
    void 匿名反馈不落任何身份信息() {
        String sessionNo = 造场次("已结束");

        String batchNo = 导入(ImportType.TRAINING_FEEDBACK, List.of(
                List.of(sessionNo, "", "4", "课程实用，希望多讲实操")));

        assertThat(行("dtl_training_feedback", batchNo)).singleElement().satisfies(row -> {
            assertThat(列(row, "submitter_no"))
                    .describedAs("出口准则 E1-7：匿名就是匿名")
                    .isNull();
            assertThat(列(row, "submitter_name"))
                    .describedAs("存了姓名等于没匿名——匿名反馈的意义是让学员敢说真话")
                    .isNull();
            assertThat(列(row, "submitter_dept"))
                    .describedAs("部门同理：一个场次里某部门只来了一个人时，部门就等于姓名")
                    .isNull();
            assertThat(row.get("score")).isEqualTo(4);
            assertThat(row.get("content")).isEqualTo("课程实用，希望多讲实操");
        });
    }

    @Test
    @DisplayName("E1-7 反向对照：填了工号的反馈必须落下工号与姓名，否则「匿名」就成了默认行为")
    void 实名反馈落下身份信息() {
        String sessionNo = 造场次("已结束");
        String employeeNo = 造人员("张三", "客服中心");

        String batchNo = 导入(ImportType.TRAINING_FEEDBACK, List.of(
                List.of(sessionNo, employeeNo, "5", "很好")));

        assertThat(行("dtl_training_feedback", batchNo)).singleElement().satisfies(row -> {
            assertThat(列(row, "submitter_no")).isEqualTo(employeeNo);
            assertThat(列(row, "submitter_name")).isEqualTo("张三");
            assertThat(列(row, "submitter_dept"))
                    .describedAs("部门是提交时的快照：这个人调岗后，这场培训的部门维度统计不该跟着变")
                    .isEqualTo("客服中心");
        });
    }

    @Test
    @DisplayName("FB4／FB5：反馈是追加语义，重复导入会翻倍，但预览必须先把已有条数说清楚")
    void 反馈追加并提示已有条数() {
        String sessionNo = 造场次("已结束");
        导入(ImportType.TRAINING_FEEDBACK, List.of(
                List.of(sessionNo, "", "4", "第一批"),
                List.of(sessionNo, "", "5", "第一批")));

        ImportPreview second = 上传(ImportType.TRAINING_FEEDBACK, List.of(
                List.of(sessionNo, "", "3", "第二批")));

        assertThat(second.notes())
                .describedAs("规则 FB5。反馈不去重，提示是运营发现自己重复上传同一份问卷的唯一机会")
                .anySatisfy(note -> assertThat(note).contains("已有 2 条").contains("追加 1 条"));
        imports.confirm(second.batchNo());
        assertThat(计数("SELECT COUNT(*) FROM dtl_training_feedback WHERE session_id = ?",
                场次ID(sessionNo)))
                .describedAs("规则 FB4：追加，不覆盖、不去重")
                .isEqualTo(3);
    }

    @Test
    @DisplayName("14.6：评分超出 1–5 报错，行号列名给到位")
    void 反馈评分越界报错() {
        String sessionNo = 造场次("已结束");

        ImportPreview preview = 上传(ImportType.TRAINING_FEEDBACK, List.of(
                List.of(sessionNo, "", "6", "打了六分")));

        assertThat(preview.canConfirm()).isFalse();
        assertThat(preview.errors()).singleElement().satisfies(problem -> {
            assertThat(problem.column()).isEqualTo("评分");
            assertThat(problem.value()).isEqualTo("6");
        });
    }

    // -------------------------------------------------------------------------
    // 14.7 试讲反馈导入
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("14.7：试讲反馈写进 dtl_trial_feedback，而不是学员反馈表")
    void 试讲反馈写入试讲反馈表() {
        long trialId = 造试讲记录();
        String employeeNo = 造人员("李四", "AI中心");

        String batchNo = 导入(ImportType.TRIAL_FEEDBACK, List.of(
                List.of(String.valueOf(trialId), employeeNo, "5", "结构清晰")));

        assertThat(行("dtl_trial_feedback", batchNo)).singleElement().satisfies(row -> {
            assertThat(row.get("trial_id")).isEqualTo(trialId);
            assertThat(row.get("submitter_no")).isEqualTo(employeeNo);
            assertThat(row.get("score")).isEqualTo(5);
        });
        assertThat(行("dtl_training_feedback", batchNo))
                .describedAs("两类反馈评的是两件事：试讲反馈进课程试讲通过率，学员反馈进讲师平均评分（R9／R10）")
                .isEmpty();
    }

    @Test
    @DisplayName("A11-10：试讲记录ID 不存在或不是数字都要报错")
    void 试讲记录ID校验() {
        ImportPreview preview = 上传(ImportType.TRIAL_FEEDBACK, List.of(
                List.of("99999999", "", "5", "记录不存在"),
                List.of("不是数字", "", "5", "格式不对")));

        assertThat(preview.canConfirm()).isFalse();
        assertThat(preview.errors()).hasSize(2)
                .allSatisfy(problem -> assertThat(problem.column()).isEqualTo("试讲记录ID"));
    }

    @Test
    @DisplayName("E1-7：试讲反馈同样支持匿名——反馈人工号是选填列")
    void 试讲反馈也能匿名() {
        long trialId = 造试讲记录();

        String batchNo = 导入(ImportType.TRIAL_FEEDBACK, List.of(
                List.of(String.valueOf(trialId), "", "4", "建议放慢节奏")));

        assertThat(行("dtl_trial_feedback", batchNo)).singleElement().satisfies(row -> {
            assertThat(列(row, "submitter_no")).isNull();
            assertThat(列(row, "submitter_name")).isNull();
        });
    }

    // -------------------------------------------------------------------------
    // 14.5 讲师导入
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("14.5：新增讲师按 JS+4 位流水生成讲师ID，同批次内连号")
    void 讲师ID流水号() {
        String a = 造人员("张三", "客服中心");
        String b = 造人员("李四", "客服中心");

        String batchNo = 导入(ImportType.LECTURER, List.of(
                List.of(a, "张三", "客服中心", "课程", "客服场景大模型", "可上岗", "在池"),
                List.of(b, "李四", "客服中心", "课程;培训", "培训体系搭建", "", "在池")));

        List<Map<String, Object>> rows = 行("biz_lecturer", batchNo);
        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(row -> (String) row.get("lecturer_no"))
                .allSatisfy(no -> assertThat(no).matches("JS\\d{4,}"));
        int first = Integer.parseInt(((String) rows.get(0).get("lecturer_no")).substring(2));
        int second = Integer.parseInt(((String) rows.get(1).get("lecturer_no")).substring(2));
        assertThat(second)
                .describedAs("同一批次内必须连号：两行都取「当前最大值 + 1」会撞唯一约束")
                .isEqualTo(first + 1);

        assertThat(rows.get(1).get("training_state"))
                .describedAs("验收 A11-6：培养状态留空按「待培养」处理")
                .isEqualTo("待培养");
        assertThat(rows.get(0).get("join_type"))
                .describedAs("入池方式由导入语义固定，不来自文件")
                .isEqualTo("批量导入");
        assertThat(rows.get(0).get("trial_qualified"))
                .describedAs("试讲合格标记只能由试讲结论产生，导入不得伪造")
                .isEqualTo(false);
    }

    @Test
    @DisplayName("擅长领域必须在所属领域可选值里，且报错要列出可选值")
    void 讲师擅长领域走字典() {
        String no = 造人员("王五", "客服中心");

        ImportPreview preview = 上传(ImportType.LECTURER, List.of(
                List.of(no, "王五", "客服中心", "零售;不存在的领域", "方向", "可上岗", "在池")));

        assertThat(preview.canConfirm()).isFalse();
        assertThat(preview.errors()).singleElement().satisfies(problem -> {
            assertThat(problem.column()).isEqualTo("擅长领域");
            assertThat(problem.value()).isEqualTo("不存在的领域");
            assertThat(problem.reason())
                    .describedAs("报错必须列出当前可选领域，否则运营无从知道该填什么")
                    .contains("零售")
                    .contains("服务");
        });
    }

    @Test
    @DisplayName("14.5：工号已存在时更新，且不动首次入池的三个事实字段")
    void 讲师更新不覆盖入池事实() {
        String employeeNo = 造人员("张三", "客服中心");
        long id = 造讲师(employeeNo, "张三", "培养中");
        Map<String, Object> before = jdbc.queryForMap("SELECT * FROM biz_lecturer WHERE id = " + id);

        ImportPreview preview = 上传(ImportType.LECTURER, List.of(
                List.of(employeeNo, "张三", "AI中心", "培训", "新方向", "可上岗", "已移出")));
        assertThat(preview.updateRows()).isEqualTo(1);
        imports.confirm(preview.batchNo());

        Map<String, Object> after = jdbc.queryForMap("SELECT * FROM biz_lecturer WHERE id = " + id);
        assertThat(after.get("training_state")).isEqualTo("可上岗");
        assertThat(after.get("pool_state")).isEqualTo("已移出");
        assertThat(after.get("source_dept")).isEqualTo("AI中心");
        assertThat(after.get("lecturer_no"))
                .describedAs("讲师ID是对外用过的编号，导入更新不得换号")
                .isEqualTo(before.get("lecturer_no"));
        assertThat(after.get("join_type"))
                .describedAs("首次入池方式是历史事实，文件里没有这一列，整行覆盖会把它改成「批量导入」")
                .isEqualTo(before.get("join_type"));
        assertThat(after.get("joined_date")).isEqualTo(before.get("joined_date"));
    }
}
