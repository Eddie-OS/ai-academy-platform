package com.aiacademy.app.dataimport;

import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.dataimport.domain.ImportBatch;
import com.aiacademy.platform.dataimport.domain.ImportPreview;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.domain.RowProblem;
import com.aiacademy.platform.dataimport.service.ImportService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 导入框架的通用规则：需求 14.1 的 I1～I9。
 *
 * <p>这些规则在框架里实现<b>一次</b>（开发 8.5 提示词第 4 条明确「I1～I8 八条规则在框架层实现一次，
 * Handler 不得各自实现」），因此用一类导入（人员）验证它们即可；6 类各自的业务规则在
 * {@link ImportHandlerIntegrationTest}。
 */
class ImportFrameworkIntegrationTest extends ImportTestBase {

    @Test
    @DisplayName("I3：任一行有错则整批不写入，批次结果记「校验失败」")
    void 存在错误行时整批不写入() {
        String 好工号 = "E" + System.nanoTime();
        ImportPreview preview = 上传(ImportType.PEOPLE, List.of(
                List.of(好工号, "张三", "客服中心", "工程师", "zhangsan@example.com", "两者", "在职"),
                List.of("E" + System.nanoTime(), "李四", "客服中心", "", "", "老师", "在职")));

        assertThat(preview.canConfirm())
                .describedAs("I3：存在错误行时确认按钮必须不可用")
                .isFalse();
        assertThat(preview.errors()).singleElement().satisfies(problem -> {
            assertThat(problem.rowNo())
                    .describedAs("I4：错误报告要给出 Excel 里能直接跳到的行号。"
                            + "表头第 1 行、示例行第 2 行，两条数据是第 3、4 行")
                    .isEqualTo(4);
            assertThat(problem.column()).isEqualTo("人员类型");
            assertThat(problem.value()).isEqualTo("老师");
            assertThat(problem.reason()).contains("讲师");
        });
        assertThat(计数("SELECT COUNT(*) FROM org_employee WHERE employee_no = ?", 好工号))
                .describedAs("I3：校验通过的那一行也不许写入——整批要么全进要么全不进")
                .isZero();

        ImportBatch batch = 批次(preview.batchNo());
        assertThat(batch.importResult()).isEqualTo(ImportBatch.RESULT_VALIDATION_FAILED);
        assertThat(batch.errorReportPath())
                .describedAs("I4：错误报告要能下载")
                .isNotNull();
        assertThat(imports.errorReport(preview.batchNo()).size())
                .describedAs("错误报告文件必须真的写出来了，而不只是库里有个路径")
                .isPositive();
    }

    @Test
    @DisplayName("I3：校验失败的批次不能被确认写入")
    void 校验失败的批次不可确认() {
        ImportPreview preview = 上传(ImportType.PEOPLE, List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在岗")));

        assertThatThrownBy(() -> imports.confirm(preview.batchNo()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("校验未通过");
    }

    @Test
    @DisplayName("I8：同一批次号重复确认只生效一次，第二次返回 DUPLICATE_SUBMIT")
    void 重复确认幂等() {
        String no = "E" + System.nanoTime();
        ImportPreview preview = 上传(ImportType.PEOPLE, List.of(
                List.of(no, "张三", "客服中心", "", "", "两者", "在职")));

        imports.confirm(preview.batchNo());
        assertThatThrownBy(() -> imports.confirm(preview.batchNo()))
                .describedAs("规则 I8。共享账号下运营重复点确认是常态，不能写两遍")
                .isInstanceOf(BizException.class)
                .hasMessageContaining("已写入");

        assertThat(计数("SELECT COUNT(*) FROM org_employee WHERE employee_no = ?", no)).isEqualTo(1);
        assertThat(批次(preview.batchNo()).batchState()).isEqualTo(ImportBatch.STATE_WRITTEN);
    }

    @Test
    @DisplayName("I2：示例行按 [示例] 前缀跳过，不当数据；空行也不算行数")
    void 示例行与空行不计入() {
        String no = "E" + System.nanoTime();
        // ImportFile.of 会自动带上示例行，再手工插一行全空行
        ImportPreview preview = 上传(ImportType.PEOPLE, List.of(
                List.of(no, "张三", "客服中心", "", "", "两者", "在职"),
                List.of("", "", "", "", "", "", "")));

        assertThat(preview.totalRows())
                .describedAs("需求 13.8.4：总行数是「校验的数据行数，不含表头与示例行」")
                .isEqualTo(1);
        assertThat(preview.canConfirm()).isTrue();
    }

    @Test
    @DisplayName("I2：示例行被删掉的文件同样能导——不能按行号硬编码跳过第 2 行")
    void 没有示例行也能导() {
        String no = "E" + System.nanoTime();
        byte[] file = ImportFile.withoutExampleRow(模板(ImportType.PEOPLE), List.of(
                List.of(no, "张三", "客服中心", "", "", "两者", "在职")));

        ImportPreview preview = 上传文件(ImportType.PEOPLE, file, "无示例行.xlsx");

        assertThat(preview.totalRows())
                .describedAs("开发 5.6.3 细节二：运营会删掉示例行，硬编码跳过第 2 行会吃掉一条真实数据")
                .isEqualTo(1);
        assertThat(preview.insertRows()).isEqualTo(1);
    }

    @Test
    @DisplayName("表头与模板不一致时整表拒绝，并把期望表头告诉运营")
    void 表头不一致整表拒绝() {
        byte[] file = ImportFile.withHeaders(
                List.of("员工号", "姓名", "所属部门", "岗位", "邮箱", "人员类型", "人员状态"),
                List.of(List.of("E001", "张三", "客服中心", "", "", "两者", "在职")));

        ImportPreview preview = 上传文件(ImportType.PEOPLE, file, "改过表头.xlsx");

        assertThat(preview.canConfirm()).isFalse();
        assertThat(preview.errors()).singleElement().satisfies(problem -> {
            assertThat(problem.rowNo())
                    .describedAs("整表级错误记行号 0，错误报告里显示「整表」")
                    .isZero();
            assertThat(problem.reason()).contains("表头与模板不一致").contains("工号");
        });
        assertThat(preview.totalRows())
                .describedAs("表头不对时不该按列序错位解析——姓名会写进岗位列，而且不报错")
                .isZero();
    }

    @Test
    @DisplayName("I1：超过 5000 行直接拒绝，且不把整个文件读完")
    void 超过五千行拒绝() {
        List<List<String>> rows = new ArrayList<>();
        for (int i = 0; i < 5001; i++) {
            rows.add(List.of("E" + i, "员工" + i, "客服中心", "", "", "学员", "在职"));
        }

        ImportPreview preview = 上传(ImportType.PEOPLE, rows);

        assertThat(preview.canConfirm()).isFalse();
        assertThat(preview.errors()).anySatisfy(problem ->
                assertThat(problem.reason()).contains("5000").contains("拆分"));
    }

    @Test
    @DisplayName("I4：错误行超过 100 条时只回传前 100 条，完整清单靠下载")
    void 错误行截断到一百条() {
        List<List<String>> rows = new ArrayList<>();
        for (int i = 0; i < 150; i++) {
            rows.add(List.of("E" + System.nanoTime() + i, "员工" + i, "客服中心", "", "", "老师", "在职"));
        }

        ImportPreview preview = 上传(ImportType.PEOPLE, rows);

        assertThat(preview.errorCount())
                .describedAs("总数要如实告诉运营")
                .isEqualTo(150);
        assertThat(preview.errors())
                .describedAs("需求 13.8.3：错误行表格默认显示前 100 条")
                .hasSize(ImportPreview.PROBLEM_PREVIEW_LIMIT);
    }

    @Test
    @DisplayName("I6：一次导入写一条「导入」审计日志，记批次号、行数与成功数")
    void 导入写一条审计日志() {
        String no = "E" + System.nanoTime();
        String batchNo = 导入(ImportType.PEOPLE, List.of(
                List.of(no, "张三", "客服中心", "", "", "两者", "在职")));
        long batchId = 批次(batchNo).id();

        List<java.util.Map<String, Object>> logs = jdbc.queryForList("""
                SELECT * FROM audit_op_log WHERE object_type = 'IMPORT_BATCH' AND object_id = ?
                """, batchId);

        assertThat(logs)
                .describedAs("规则 I6 要的是「一次导入一条」，不是「一行一条」——"
                        + "5000 行写 5000 条会把真正需要追溯的手工修改淹掉，行级追溯由 import_row_snapshot 承担")
                .singleElement()
                .satisfies(log -> {
                    assertThat(log.get("op_type")).isEqualTo("导入");
                    assertThat(log.get("account_type")).isEqualTo("OPS");
                    assertThat((String) log.get("remark")).contains(batchNo).contains("共 1 行");
                });
    }

    @Test
    @DisplayName("I5：批次号 = 对象类型缩写 + 年月日时分秒，且原文件可下载")
    void 批次号规则与原文件留存() {
        String batchNo = 导入(ImportType.PEOPLE, List.of(
                List.of("E" + System.nanoTime(), "张三", "客服中心", "", "", "两者", "在职")));

        assertThat(batchNo).matches("RY\\d{14}");

        ImportService.DownloadableFile source = imports.sourceFile(batchNo);
        assertThat(source.fileName()).isEqualTo("test.xlsx");
        assertThat(source.size())
                .describedAs("原文件必须留存：确认写入是另一次请求，要重新解析同一份文件（开发 5.6.3 细节一）")
                .isPositive();
    }

    @Test
    @DisplayName("确认写入前重新校验：上传通过后引用数据被删，确认时必须拦下")
    void 确认前重新校验() {
        String sessionNo = 造场次("已开课");
        String employeeNo = 造人员("张三", "客服中心");
        ImportPreview preview = 上传(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "张三", "已签到", "", "")));
        assertThat(preview.canConfirm()).isTrue();

        // 运营点确认之前，这个场次被删了
        jdbc.update("UPDATE biz_training_session SET deleted = TRUE WHERE session_no = ?", sessionNo);

        assertThatThrownBy(() -> imports.confirm(preview.batchNo()))
                .describedAs("开发 5.6.3 细节一：校验与写入之间有时间差，写入前必须重新校验")
                .isInstanceOf(BizException.class)
                .hasMessageContaining("发生了变化");
        assertThat(批次(preview.batchNo()).importResult()).isEqualTo(ImportBatch.RESULT_VALIDATION_FAILED);
    }

    @Test
    @DisplayName("警告不阻断写入，但会一并写进错误报告")
    void 警告不阻断() {
        String sessionNo = 造场次("已开课");
        String employeeNo = 造人员("张三", "客服中心");

        ImportPreview preview = 上传(ImportType.ATTENDANCE, List.of(
                List.of(sessionNo, employeeNo, "张三丰", "已签到", "", "")));

        assertThat(preview.canConfirm())
                .describedAs("开发 5.6.3 细节六：姓名不一致是警告，不是错误")
                .isTrue();
        assertThat(preview.warnings()).singleElement()
                .extracting(RowProblem::reason, org.assertj.core.api.InstanceOfAssertFactories.STRING)
                .contains("张三");
        assertThat(批次(preview.batchNo()).errorReportPath())
                .describedAs("只有警告时也生成报告：需求 14.3 的离职负责人警告清单只在界面弹一下运营记不住")
                .isNotNull();
    }
}
