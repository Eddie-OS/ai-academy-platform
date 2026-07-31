package com.aiacademy.app.dataimport;

import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.dataimport.domain.ImportBatch;
import com.aiacademy.platform.dataimport.domain.ImportPreview;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.domain.RevokeResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 出口准则 <b>E1-6</b>：导入的批次撤销能把数据完整还原到导入前状态；以及需求 13.8.5 的 RB1～RB9。
 *
 * <p><b>为什么用「整行 JSONB 相等」来验证还原：</b>逐个字段断言只能证明「我想到的那几列还原了」。
 * 撤销出错的典型形态恰恰是想不到的列——把 {@code import_batch_no} 留成新批次号、
 * 把 {@code created_by} 覆盖成撤销人、漏还原一个刚加的列。整行比较对这些一网打尽，
 * 而且新增列时不需要回来补断言。
 */
class ImportRevokeIntegrationTest extends ImportTestBase {

    @Test
    @DisplayName("E1-6：撤销后新增的行被逻辑删除、更新的行整行还原成导入前的样子")
    void 撤销完整还原() {
        String 老工号 = 造人员("张三", "客服中心");
        String 新工号 = "E" + System.nanoTime();
        String 导入前 = 整行(老工号);

        String batchNo = 导入(ImportType.PEOPLE, List.of(
                List.of(老工号, "张三丰", "AI中心", "高级工程师", "new@example.com", "讲师", "离职"),
                List.of(新工号, "李四", "客服中心", "", "", "学员", "在职")));
        assertThat(整行(老工号)).isNotEqualTo(导入前);

        RevokeResult result = imports.revoke(batchNo);

        assertThat(result.revokedRows()).isEqualTo(2);
        assertThat(result.skippedRows()).isZero();
        assertThat(整行(老工号))
                .describedAs("出口准则 E1-6：整行逐列还原，一列都不许留下导入的痕迹")
                .isEqualTo(导入前);
        assertThat(计数("SELECT COUNT(*) FROM org_employee WHERE employee_no = ? AND deleted = TRUE",
                新工号))
                .describedAs("规则 RB2：新增的行撤销为逻辑删除，不是物理删除（F5／SEC2 全系统逻辑删除）")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("RB3：导入后又被人改过的行不还原，并把行号列进「已跳过」清单")
    void 已被后续修改的行跳过() {
        String 工号A = 造人员("张三", "客服中心");
        String 工号B = 造人员("李四", "客服中心");

        String batchNo = 导入(ImportType.PEOPLE, List.of(
                List.of(工号A, "张三丰", "AI中心", "", "", "讲师", "在职"),
                List.of(工号B, "李四光", "AI中心", "", "", "讲师", "在职")));

        // 运营在导入之后手工订正了第一个人的岗位
        jdbc.update("""
                UPDATE org_employee SET position = '产品经理', updated_at = NOW(), updated_by = 'OPS'
                 WHERE employee_no = ?
                """, 工号A);
        String 手工修改后 = 整行(工号A);

        RevokeResult result = imports.revoke(batchNo);

        assertThat(result.skippedRowNos())
                .describedAs("规则 RB3 要求「列出跳过的行」，行号是 Excel 行号，运营才能自己核对。"
                        + "表头 1 行 + 示例 1 行，两条数据是第 3、4 行")
                .containsExactly(3);
        assertThat(整行(工号A))
                .describedAs("撤销一个旧批次不能把之后的手工修改覆盖掉——那比不撤销更糟，"
                        + "因为运营以为自己只是撤销了导入")
                .isEqualTo(手工修改后);
        assertThat(计数("SELECT COUNT(*) FROM org_employee WHERE employee_no = ? AND employee_name = '李四'",
                工号B))
                .describedAs("没被动过的那一行照常还原")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("A8-7：撤销签到批次时，随签到自动加入的名单行一并回滚")
    void 撤销签到连带回滚自动加入的名单() {
        String sessionNo = 造场次("已开课");
        String employeeNo = 造人员("张三", "客服中心");
        long sessionId = 场次ID(sessionNo);

        String batchNo = 导入(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "", "已签到", "", "")));
        assertThat(计数("SELECT COUNT(*) FROM dtl_session_attendee WHERE session_id = ? AND deleted = FALSE",
                sessionId)).isEqualTo(1);

        imports.revoke(batchNo);

        assertThat(计数("SELECT COUNT(*) FROM dtl_attendance WHERE session_id = ? AND deleted = FALSE",
                sessionId)).isZero();
        assertThat(计数("SELECT COUNT(*) FROM dtl_session_attendee WHERE session_id = ? AND deleted = FALSE",
                sessionId))
                .describedAs("验收 A8-7：一行签到写了两张表，撤销要两张表一起回滚。"
                        + "留下名单行会让这个人凭空出现在参训名单里，而没有任何签到记录")
                .isZero();
    }

    @Test
    @DisplayName("A8-7 反向对照：本来就在名单里的人，撤销签到不该把他的名单记录删掉")
    void 撤销签到不动运营指派的名单() {
        String sessionNo = 造场次("已开课");
        String employeeNo = 造人员("张三", "客服中心");
        long sessionId = 场次ID(sessionNo);
        导入(ImportType.ATTENDEE, List.of(List.of(sessionNo, employeeNo, "张三")));

        String batchNo = 导入(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "", "已签到", "", "")));
        imports.revoke(batchNo);

        assertThat(计数("""
                SELECT COUNT(*) FROM dtl_session_attendee
                 WHERE session_id = ? AND deleted = FALSE AND join_source = '运营指派'
                """, sessionId))
                .describedAs("名单是另一个批次写的。按「撤销签到就清空名单」实现会连带删掉它，"
                        + "而那条记录与本批次无关")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("RB7：反馈批次撤销为整批逻辑删除，且不误伤别的批次导入的反馈")
    void 撤销反馈批次() {
        String sessionNo = 造场次("已结束");
        long sessionId = 场次ID(sessionNo);
        导入(ImportType.TRAINING_FEEDBACK, List.of(List.of(sessionNo, "", "5", "第一批")));
        String 第二批 = 导入(ImportType.TRAINING_FEEDBACK, List.of(
                List.of(sessionNo, "", "4", "第二批甲"),
                List.of(sessionNo, "", "3", "第二批乙")));

        RevokeResult result = imports.revoke(第二批);

        assertThat(result.revokedRows()).isEqualTo(2);
        assertThat(jdbc.queryForList("""
                SELECT content FROM dtl_training_feedback
                 WHERE session_id = ? AND deleted = FALSE
                """, sessionId))
                .describedAs("撤销必须按批次，而不是「清掉这个场次的反馈」——"
                        + "反馈是追加语义，同一场次常有多个批次")
                .extracting(row -> row.get("content"))
                .containsExactly("第一批");
    }

    @Test
    @DisplayName("RB4：已撤销的批次不能再撤销一次")
    void 不可重复撤销() {
        String batchNo = 导入(ImportType.PEOPLE, List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在职")));
        imports.revoke(batchNo);

        assertThatThrownBy(() -> imports.revoke(batchNo))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("已撤销");
    }

    @Test
    @DisplayName("RB6：校验失败的批次没写入任何数据，撤销无从谈起")
    void 校验失败的批次不可撤销() {
        ImportPreview preview = 上传(ImportType.PEOPLE, List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在岗")));

        assertThatThrownBy(() -> imports.revoke(preview.batchNo()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("导入成功");
    }

    @Test
    @DisplayName("RB5：撤销写一条审计日志、结果改「已撤销」，批次记录与原文件都保留")
    void 撤销留痕() {
        String batchNo = 导入(ImportType.PEOPLE, List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在职")));
        long batchId = 批次(batchNo).id();

        imports.revoke(batchNo);

        ImportBatch batch = 批次(batchNo);
        assertThat(batch.importResult()).isEqualTo(ImportBatch.RESULT_REVOKED);
        assertThat(batch.batchState())
                .describedAs("撤销记在「结果」上而不是「状态」上：batch_state 是幂等状态机（待确认 → 已写入），"
                        + "把它改成「已撤销」等于让这个批次号可以再被确认一次")
                .isEqualTo(ImportBatch.STATE_WRITTEN);

        List<Map<String, Object>> logs = jdbc.queryForList("""
                SELECT * FROM audit_op_log
                 WHERE object_type = 'IMPORT_BATCH' AND object_id = ? AND op_type = '撤销导入'
                """, batchId);
        assertThat(logs).singleElement().satisfies(log ->
                assertThat((String) log.get("remark")).contains(batchNo).contains("回滚 1 行"));

        assertThat(imports.sourceFile(batchNo).size())
                .describedAs("撤销后批次记录与原文件都要留着：运营撤销往往是为了改完重导，"
                        + "而「上次导的到底是哪份文件」是唯一线索")
                .isPositive();
        assertThat(计数("SELECT COUNT(*) FROM import_row_snapshot WHERE batch_no = ?", batchNo))
                .describedAs("行快照也不删：它是这次撤销做了什么的唯一凭据")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("讲师导入撤销：更新的讲师整行还原（通用还原逻辑不按导入类型分支的证据）")
    void 撤销讲师批次() {
        String employeeNo = 造人员("张三", "客服中心");
        long id = 造讲师(employeeNo, "张三", "培养中");
        String 导入前 = jdbc.queryForObject(
                "SELECT to_jsonb(t)::text FROM biz_lecturer t WHERE id = ?", String.class, id);

        String batchNo = 导入(ImportType.LECTURER, List.of(
                List.of(employeeNo, "张三", "AI中心", "培训", "新方向", "可上岗", "已移出")));
        imports.revoke(batchNo);

        assertThat(jdbc.queryForObject(
                "SELECT to_jsonb(t)::text FROM biz_lecturer t WHERE id = ?", String.class, id))
                .describedAs("撤销是框架的通用能力（按 import_row_snapshot 回放），"
                        + "6 类导入不需要各写一遍还原逻辑——那才是 RB2 被漏做的常见原因")
                .isEqualTo(导入前);
    }

    // -------------------------------------------------------------------------

    /** 整行 JSONB。字段顺序由列顺序决定，因此可以直接比字符串。 */
    private String 整行(String employeeNo) {
        return jdbc.queryForObject(
                "SELECT to_jsonb(t)::text FROM org_employee t WHERE employee_no = ?",
                String.class, employeeNo);
    }
}
