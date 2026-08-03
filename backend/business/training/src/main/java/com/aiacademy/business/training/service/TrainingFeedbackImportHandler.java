package com.aiacademy.business.training.service;

import com.aiacademy.business.training.domain.SessionRef;
import com.aiacademy.business.training.repository.TrainingImportMapper;
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
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 学员反馈导入（需求 14.6）。<b>正式培训学员反馈的唯一录入入口</b>（D35、C12）——
 * 一期学员不在系统内提交反馈（N20），问卷线下收集、运营导入。
 *
 * <p><b>与试讲反馈导入（{@code TrialFeedbackImportHandler}）刻意写成两个类。</b>需求 14.7 表末专门
 * 警告过：两个模板长得几乎一样，但关联键（场次 / 试讲记录）、目标表、是否计入讲师平均评分三处完全
 * 不同。这张表是讲师平均评分的唯一数据源（需求 15.3），试讲反馈不计入（规则 R10）。合并成一个带
 * type 参数的 Service，错的那一处（评分口径）在界面上看不出来。
 *
 * <p>两个必须做对的点：
 * <ul>
 *   <li><b>匿名</b>：工号留空时 {@code submitter_no} 写 NULL，不是存了再隐藏（出口准则 E1-7）；
 *   <li><b>追加语义</b>：同一场次多次导入全部追加、不覆盖、不去重（规则 I9、FB4）。同一个人可以
 *       交两份反馈，匿名行更是识别不出人，去重会把真实数据判成重复。
 * </ul>
 */
@Service
public class TrainingFeedbackImportHandler implements ImportHandler {

    private static final String TABLE = "dtl_training_feedback";

    private static final String COL_SESSION = "培训场次ID";
    private static final String COL_EMPLOYEE = "学员工号";
    private static final String COL_SCORE = "评分";
    private static final String COL_CONTENT = "反馈内容";

    /**
     * 需求 14.6 A 列：已开课、已结束或已归档。比签到多一个「已归档」——反馈常常在结束后才收齐。
     *
     * <p>状态值取状态机模块的常量，本文件里不出现状态字符串（出口准则 E2-6）。
     */
    private static final Set<String> ALLOWED_SESSION_STATES = Set.of(
            TrainingStateMachines.SESSION_OPENED,
            TrainingStateMachines.SESSION_FINISHED,
            TrainingStateMachines.SESSION_ARCHIVED);

    private static final String STATE_HINT = TrainingStateMachines.SESSION_OPENED + "、"
            + TrainingStateMachines.SESSION_FINISHED + "或" + TrainingStateMachines.SESSION_ARCHIVED;

    private final TrainingImportMapper mapper;
    private final EmployeeImportSupport employees;

    public TrainingFeedbackImportHandler(TrainingImportMapper mapper, EmployeeImportSupport employees) {
        this.mapper = mapper;
        this.employees = employees;
    }

    @Override
    public ImportType type() {
        return ImportType.TRAINING_FEEDBACK;
    }

    @Override
    public ImportTemplateSpec template() {
        return new ImportTemplateSpec(ImportType.TRAINING_FEEDBACK, List.of(
                ImportColumn.required(COL_SESSION, 64, "如 JH2026070001-01，须为" + STATE_HINT + "的场次",
                        "JH2026070001-01"),
                ImportColumn.optional(COL_EMPLOYEE, 50, "留空即匿名；填写时须在人员台账中存在", ""),
                ImportColumn.required(COL_SCORE, "整数 1–5", "5"),
                ImportColumn.optional(COL_CONTENT, 5000, "≤5000 字", "案例讲得很实用，希望增加实操环节")),
                "本次导入为追加，不会覆盖已有反馈。学员工号留空即匿名，匿名反馈同样计入讲师平均评分。");
    }

    @Override
    public ImportPlan plan(List<ImportRow> rows, ImportProblems problems) {
        Map<String, SessionRef> sessions = loadSessions(rows);
        Map<String, Employee> people = employees.loadByColumn(rows, COL_EMPLOYEE);
        ImportPlan plan = new ImportPlan();
        Map<String, Integer> addedPerSession = new LinkedHashMap<>();

        for (ImportRow row : rows) {
            String sessionNo = row.text(COL_SESSION);
            String employeeNo = row.text(COL_EMPLOYEE);
            SessionRef session = sessions.get(sessionNo);
            boolean valid = true;

            if (!sessionNo.isEmpty() && session == null) {
                problems.error(row, COL_SESSION, "培训场次不存在");
                valid = false;
            } else if (session != null && !ALLOWED_SESSION_STATES.contains(session.sessionState())) {
                problems.error(row, COL_SESSION,
                        "场次当前状态为「%s」，只有%s的场次可以导入反馈"
                                .formatted(session.sessionState(), STATE_HINT));
                valid = false;
            }

            // 工号是选填列：留空即匿名；填了就必须存在（需求 14.6 B 列）
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

            plan.insert(row, new FeedbackWrite(session.id(),
                    // 匿名：三列一起留空。姓名与部门也不能存——存了等于没匿名
                    employee == null ? null : employeeNo,
                    employee == null ? null : employee.getEmployeeName(),
                    employee == null ? null : employee.getDeptName(),
                    score, blankToNull(row.text(COL_CONTENT))));
            addedPerSession.merge(sessionNo, 1, Integer::sum);
        }

        noteExistingFeedback(sessions, addedPerSession, plan);
        return plan;
    }

    @Override
    public void write(ImportPlan plan, ImportRowWriter writer) {
        for (PlannedRow planned : plan.rows()) {
            FeedbackWrite write = planned.payloadAs(FeedbackWrite.class);
            writer.insert(planned.rowNo(), TABLE, () -> mapper.insertFeedback(
                    write.sessionId(), write.submitterNo(), write.submitterName(), write.submitterDept(),
                    write.score(), write.content(), writer.batchNo(), writer.operator()));
        }
    }

    /**
     * 规则 FB5：导入前提示「本场次已有 N 条反馈，本次将追加 M 条」。
     *
     * <p>这条提示不是装饰。反馈是追加语义，运营重复上传同一份问卷不会报任何错，只会把条数翻倍，
     * 而讲师平均评分是按条数算的——提示是运营发现自己重复上传的唯一机会。
     */
    private void noteExistingFeedback(Map<String, SessionRef> sessions,
                                      Map<String, Integer> addedPerSession, ImportPlan plan) {
        if (addedPerSession.isEmpty()) {
            return;
        }
        Map<Long, Long> existing = new HashMap<>();
        Set<Long> ids = sessions.values().stream().map(SessionRef::id)
                .collect(java.util.stream.Collectors.toSet());
        if (!ids.isEmpty()) {
            for (TrainingImportMapper.CountBySession count : mapper.countFeedbackBySessions(ids)) {
                existing.put(count.id(), count.cnt());
            }
        }
        addedPerSession.forEach((sessionNo, added) -> {
            SessionRef session = sessions.get(sessionNo);
            long already = existing.getOrDefault(session.id(), 0L);
            plan.note("场次 %s 已有 %d 条反馈，本次将追加 %d 条".formatted(sessionNo, already, added));
        });
    }

    /** @param submitterNo 匿名时为 null（出口准则 E1-7） */
    private record FeedbackWrite(long sessionId, String submitterNo, String submitterName,
                                 String submitterDept, int score, String content) {
    }

    private Map<String, SessionRef> loadSessions(List<ImportRow> rows) {
        Set<String> nos = new LinkedHashSet<>();
        for (ImportRow row : rows) {
            String no = row.text(COL_SESSION);
            if (!no.isEmpty()) {
                nos.add(no);
            }
        }
        if (nos.isEmpty()) {
            return Map.of();
        }
        Map<String, SessionRef> byNo = new HashMap<>();
        for (SessionRef session : mapper.findSessionsByNos(nos)) {
            byNo.put(session.sessionNo(), session);
        }
        return byNo;
    }

    private static String blankToNull(String value) {
        return value.isEmpty() ? null : value;
    }
}
