package com.aiacademy.app.dataimport;

import com.aiacademy.platform.dataimport.domain.ImportPreview;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.domain.RevokeResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 出口准则 <b>E1-4</b>：5000 行签到导入在 60 秒内完成（需求 P4）。
 *
 * <p><b>为什么必须压最重的那一类：</b>签到导入一行最多写两张表（签到 + 自动补名单），
 * 每次写还要落一条行快照，是 6 类里单行代价最高的；它同时也是使用频率最高的一类。
 * 拿人员导入（一行一张表）来验 P4 会给出一个偏乐观的结论。
 *
 * <p>本测试同时把「读文件、校验、写入」三段耗时分别打出来。P4 超标时，
 * 知道是卡在 Excel 解析、逐行查库还是逐行 INSERT，比只知道「总共 90 秒」有用得多。
 * 逐行查库是这里最容易犯的错——5000 行 × 一次 SELECT 就是 5000 次往返，
 * 因此各 Handler 一律先批量装载再在内存里比对。
 */
class ImportPerformanceTest extends ImportTestBase {

    private static final Logger log = LoggerFactory.getLogger(ImportPerformanceTest.class);

    private static final int ROWS = 5000;
    private static final Duration LIMIT = Duration.ofSeconds(60);

    @Test
    @DisplayName("E1-4：5000 行签到导入（含自动补名单与行快照，共 1 万次写）在 60 秒内完成")
    void 五千行签到导入() {
        String sessionNo = 造场次("已开课");
        List<String> employees = 批量造人员(ROWS);
        List<List<String>> rows = new ArrayList<>(ROWS);
        for (int i = 0; i < ROWS; i++) {
            rows.add(List.of(sessionNo, employees.get(i), "员工" + i, "已签到",
                    "2026-08-01 09:0" + (i % 10), ""));
        }
        byte[] file = ImportFile.of(模板(ImportType.ATTENDANCE), rows);

        long t0 = System.nanoTime();
        ImportPreview preview = 上传文件(ImportType.ATTENDANCE, file, "压测-签到.xlsx");
        long t1 = System.nanoTime();
        assertThat(preview.canConfirm())
                .describedAs("压测数据本身必须是干净的：%s", preview.errors())
                .isTrue();
        assertThat(preview.insertRows()).isEqualTo(ROWS);

        imports.confirm(preview.batchNo());
        long t2 = System.nanoTime();

        Duration 校验 = Duration.ofNanos(t1 - t0);
        Duration 写入 = Duration.ofNanos(t2 - t1);
        Duration 总计 = Duration.ofNanos(t2 - t0);
        log.info("E1-4 压测：解析+校验 {} ms，写入 {} ms，合计 {} ms（{} 行）",
                校验.toMillis(), 写入.toMillis(), 总计.toMillis(), ROWS);

        assertThat(计数("SELECT COUNT(*) FROM dtl_attendance WHERE import_batch_no = ?", preview.batchNo()))
                .isEqualTo(ROWS);
        assertThat(计数("SELECT COUNT(*) FROM dtl_session_attendee WHERE import_batch_no = ?",
                preview.batchNo()))
                .describedAs("这 5000 人都不在名单里，因此还要补 5000 条名单——单行代价最高的路径")
                .isEqualTo(ROWS);
        assertThat(计数("SELECT COUNT(*) FROM import_row_snapshot WHERE batch_no = ?", preview.batchNo()))
                .describedAs("每一次写都要有快照，否则撤销还原不回来")
                .isEqualTo(ROWS * 2);

        assertThat(总计)
                .describedAs("需求 P4／出口准则 E1-4：5000 行 ≤ 60 秒。"
                        + "实测 解析+校验 %d ms、写入 %d ms", 校验.toMillis(), 写入.toMillis())
                .isLessThanOrEqualTo(LIMIT);

        // 撤销 5000 行同样是逐行操作，顺带量一下它的量级——需求没给撤销定时限，
        // 但如果它比导入慢一个数量级，运营会以为界面卡死了
        long t3 = System.nanoTime();
        RevokeResult result = imports.revoke(preview.batchNo());
        Duration 撤销 = Duration.ofNanos(System.nanoTime() - t3);
        log.info("5000 行签到批次撤销：{} ms，回滚 {} 行", 撤销.toMillis(), result.revokedRows());
        assertThat(result.revokedRows()).isEqualTo(ROWS * 2);
        assertThat(撤销).isLessThanOrEqualTo(LIMIT);
    }

    @Test
    @DisplayName("E1-4：5000 行人员导入（一半新增一半更新）在 60 秒内完成")
    void 五千行人员导入() {
        List<String> existing = 批量造人员(ROWS / 2);
        List<List<String>> rows = new ArrayList<>(ROWS);
        for (String no : existing) {
            rows.add(List.of(no, "改过的名字", "AI中心", "工程师", "", "两者", "在职"));
        }
        long seed = System.nanoTime();
        for (int i = 0; i < ROWS / 2; i++) {
            rows.add(List.of("N" + seed + "-" + i, "新员工" + i, "客服中心", "", "", "学员", "在职"));
        }
        byte[] file = ImportFile.of(模板(ImportType.PEOPLE), rows);

        long t0 = System.nanoTime();
        ImportPreview preview = 上传文件(ImportType.PEOPLE, file, "压测-人员.xlsx");
        long t1 = System.nanoTime();
        assertThat(preview.canConfirm()).isTrue();
        assertThat(preview.updateRows())
                .describedAs("一半是更新：更新路径要先取前值快照，比新增多一次写")
                .isEqualTo(ROWS / 2);

        imports.confirm(preview.batchNo());
        Duration 总计 = Duration.ofNanos(System.nanoTime() - t0);
        log.info("E1-4 压测（人员）：解析+校验 {} ms，合计 {} ms",
                Duration.ofNanos(t1 - t0).toMillis(), 总计.toMillis());

        assertThat(总计).isLessThanOrEqualTo(LIMIT);
    }

    /** 造人员用一条多值 INSERT，不走导入——夹具耗时不该算进被测时间。 */
    private List<String> 批量造人员(int count) {
        List<String> nos = new ArrayList<>(count);
        StringBuilder sql = new StringBuilder("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by) VALUES
                """);
        long seed = System.nanoTime();
        for (int i = 0; i < count; i++) {
            String no = "P" + seed + "-" + i;
            nos.add(no);
            sql.append(i == 0 ? "" : ",")
                    .append("('").append(no).append("', '员工").append(i)
                    .append("', '客服中心', '学员', '在职', 'OPS')");
        }
        jdbc.update(sql.toString());
        return nos;
    }
}
