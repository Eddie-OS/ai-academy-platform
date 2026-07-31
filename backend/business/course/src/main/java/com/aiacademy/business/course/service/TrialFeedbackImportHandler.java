package com.aiacademy.business.course.service;

import com.aiacademy.business.course.repository.CourseTrialImportMapper;
import com.aiacademy.platform.dataimport.ImportHandler;
import com.aiacademy.platform.dataimport.ImportRowWriter;
import com.aiacademy.platform.dataimport.domain.ImportColumn;
import com.aiacademy.platform.dataimport.domain.ImportPlan;
import com.aiacademy.platform.dataimport.domain.ImportProblems;
import com.aiacademy.platform.dataimport.domain.ImportRow;
import com.aiacademy.platform.dataimport.domain.ImportTemplateSpec;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.domain.PlannedRow;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeImportSupport;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 试讲反馈导入（需求 14.7）。
 *
 * <p><b>这是 V1.2 最容易实现错的一处</b>（需求 14.7 表末原话）。它与学员反馈导入
 * （{@code TrainingFeedbackImportHandler}）的模板长得几乎一样，但三处完全不同：
 *
 * <table>
 *   <caption>与 14.6 的差异</caption>
 *   <tr><th>项</th><th>学员反馈</th><th>试讲反馈（本类）</th></tr>
 *   <tr><td>关联键</td><td>培训场次ID</td><td><b>试讲记录ID</b></td></tr>
 *   <tr><td>目标表</td><td>dtl_training_feedback</td><td><b>dtl_trial_feedback</b></td></tr>
 *   <tr><td>讲师平均评分</td><td>计入</td><td><b>不计入</b>（规则 R10）</td></tr>
 *   <tr><td>内容上限</td><td>5000 字</td><td><b>2000 字</b></td></tr>
 * </table>
 *
 * <p>因此需求明确要求写两个处理器，「宁可有重复代码，也不要在指标口径上出错」。
 *
 * <p>验收 A11-10：填入场次ID（如 {@code JH2026070001-01}）时必须校验失败。试讲记录ID 是数字主键
 * （需求 9.7.1 第 1 项），场次ID 不是数字，因此会在解析这一步就被判为非法。
 */
@Service
public class TrialFeedbackImportHandler implements ImportHandler {

    private static final String TABLE = "dtl_trial_feedback";

    private static final String COL_TRIAL = "试讲记录ID";
    private static final String COL_EMPLOYEE = "反馈人工号";
    private static final String COL_SCORE = "评分";
    private static final String COL_CONTENT = "反馈内容";

    private final CourseTrialImportMapper mapper;
    private final EmployeeImportSupport employees;

    public TrialFeedbackImportHandler(CourseTrialImportMapper mapper, EmployeeImportSupport employees) {
        this.mapper = mapper;
        this.employees = employees;
    }

    @Override
    public ImportType type() {
        return ImportType.TRIAL_FEEDBACK;
    }

    @Override
    public ImportTemplateSpec template() {
        return new ImportTemplateSpec(ImportType.TRIAL_FEEDBACK, List.of(
                ImportColumn.required(COL_TRIAL, "试讲记录的数字ID。注意不是课程ID、不是培训场次ID", "1024"),
                ImportColumn.optional(COL_EMPLOYEE, 50, "留空即匿名；填写时须在人员台账中存在", ""),
                ImportColumn.required(COL_SCORE, "整数 1–5", "4"),
                ImportColumn.optional(COL_CONTENT, 2000, "≤2000 字", "讲解清晰，建议补充失败案例")),
                "本次导入为追加，不会覆盖已有反馈。试讲反馈不计入讲师平均评分，只在本轮试讲内统计。");
    }

    @Override
    public ImportPlan plan(List<ImportRow> rows, ImportProblems problems) {
        Set<Long> trialIds = new LinkedHashSet<>();
        for (ImportRow row : rows) {
            Integer id = row.intOrNull(COL_TRIAL);
            if (id != null) {
                trialIds.add(id.longValue());
            }
        }
        Set<Long> existingTrials = trialIds.isEmpty()
                ? Set.of()
                : new LinkedHashSet<>(mapper.findExistingTrialIds(trialIds));
        Map<String, Employee> people = employees.loadByColumn(rows, COL_EMPLOYEE);
        ImportPlan plan = new ImportPlan();

        for (ImportRow row : rows) {
            boolean valid = true;

            Integer trialId = row.intOrNull(COL_TRIAL);
            if (!row.isBlank(COL_TRIAL) && trialId == null) {
                // 验收 A11-10 走到这里：填了场次ID 这类非数字值
                problems.error(row, COL_TRIAL, "试讲记录ID 应为数字。注意这里填的是试讲记录ID，不是培训场次ID");
                valid = false;
            } else if (trialId != null && !existingTrials.contains(trialId.longValue())) {
                problems.error(row, COL_TRIAL, "试讲记录不存在");
                valid = false;
            }

            String employeeNo = row.text(COL_EMPLOYEE);
            Employee employee = null;
            if (!employeeNo.isEmpty()) {
                employee = people.get(employeeNo);
                if (employee == null) {
                    problems.error(row, COL_EMPLOYEE, EmployeeImportSupport.NOT_FOUND);
                    valid = false;
                }
            }

            Integer score = row.intOrNull(COL_SCORE);
            if (!row.isBlank(COL_SCORE) && (score == null || score < 1 || score > 5)) {
                problems.error(row, COL_SCORE, "评分只能是 1 到 5 的整数");
                valid = false;
            }
            if (!valid) {
                continue;
            }

            plan.insert(row, new TrialFeedbackWrite(trialId.longValue(),
                    employee == null ? null : employeeNo,
                    employee == null ? null : employee.getEmployeeName(),
                    score, blankToNull(row.text(COL_CONTENT))));
        }
        return plan;
    }

    @Override
    public void write(ImportPlan plan, ImportRowWriter writer) {
        for (PlannedRow planned : plan.rows()) {
            TrialFeedbackWrite write = planned.payloadAs(TrialFeedbackWrite.class);
            writer.insert(planned.rowNo(), TABLE, () -> mapper.insertTrialFeedback(
                    write.trialId(), write.submitterNo(), write.submitterName(),
                    write.score(), write.content(), writer.batchNo(), writer.operator()));
        }
    }

    /** @param submitterNo 匿名时为 null（出口准则 E1-7） */
    private record TrialFeedbackWrite(long trialId, String submitterNo, String submitterName,
                                      int score, String content) {
    }

    private static String blankToNull(String value) {
        return value.isEmpty() ? null : value;
    }
}
