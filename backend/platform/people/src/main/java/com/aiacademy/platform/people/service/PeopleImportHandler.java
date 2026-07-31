package com.aiacademy.platform.people.service;

import com.aiacademy.platform.dataimport.ImportHandler;
import com.aiacademy.platform.dataimport.ImportRowWriter;
import com.aiacademy.platform.dataimport.domain.ImportColumn;
import com.aiacademy.platform.dataimport.domain.ImportPlan;
import com.aiacademy.platform.dataimport.domain.ImportProblems;
import com.aiacademy.platform.dataimport.domain.ImportRow;
import com.aiacademy.platform.dataimport.domain.ImportTemplateSpec;
import com.aiacademy.platform.dataimport.domain.ImportType;
import com.aiacademy.platform.dataimport.domain.PlannedRow;
import com.aiacademy.platform.dataimport.domain.RowOp;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.domain.EmployeeForm;
import com.aiacademy.platform.people.repository.EmployeeMapper;
import com.aiacademy.platform.people.repository.OwnedObjectMapper;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 人员导入（需求 14.3）。唯一键工号：已存在则更新除工号外的全部字段，不存在则新增。
 *
 * <p>它是六类导入的<b>前置</b>：另外五类都要校验工号在人员表中存在（签到、参训名单、讲师、
 * 两类反馈），空台账下它们一行都导不进去。
 *
 * <p><b>这张表不承载任何权限含义</b>（C04、需求 14.3 表末）：能不能写数据取决于用哪个共享账号登录，
 * 与你在台账里是谁无关。因此这里没有、也不许加任何角色字段。
 */
@Service
public class PeopleImportHandler implements ImportHandler {

    private static final String TABLE = "org_employee";

    private static final String COL_NO = "工号";
    private static final String COL_NAME = "姓名";
    private static final String COL_DEPT = "所属部门";
    private static final String COL_POSITION = "岗位";
    private static final String COL_EMAIL = "邮箱";
    private static final String COL_TYPE = "人员类型";
    private static final String COL_STATE = "人员状态";

    private static final Set<String> PERSON_TYPES = Set.of("讲师", "学员", "两者");
    private static final Set<String> PERSON_STATES = Set.of("在职", "离职");
    private static final String STATE_LEFT = "离职";

    /** 只挡明显不是邮箱的输入。一期邮箱不用于发送（MSG1），严格校验只会把正常数据挡在外面。 */
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final EmployeeMapper employees;
    private final OwnedObjectMapper ownedObjects;

    public PeopleImportHandler(EmployeeMapper employees, OwnedObjectMapper ownedObjects) {
        this.employees = employees;
        this.ownedObjects = ownedObjects;
    }

    @Override
    public ImportType type() {
        return ImportType.PEOPLE;
    }

    @Override
    public ImportTemplateSpec template() {
        return new ImportTemplateSpec(ImportType.PEOPLE, List.of(
                ImportColumn.required(COL_NO, 50, "≤50 字符，唯一键", "E0001"),
                ImportColumn.required(COL_NAME, 50, "≤50 字", "张三"),
                // V1.2：自由文本、不校验（N18 组织架构整体不做）
                ImportColumn.required(COL_DEPT, 50, "≤50 字，自由文本", "客服中心"),
                ImportColumn.optional(COL_POSITION, 100, "≤100 字", "高级工程师"),
                ImportColumn.optional(COL_EMAIL, 100, "邮箱格式。一期不用于发送，仅线下联系参考",
                        "zhangsan@example.com"),
                ImportColumn.required(COL_TYPE, "讲师 / 学员 / 两者", "两者"),
                ImportColumn.required(COL_STATE, "在职 / 离职", "在职")),
                "本表是一份名录，不开通任何登录权限。工号已存在时更新其余全部字段，不存在时新增。");
    }

    @Override
    public ImportPlan plan(List<ImportRow> rows, ImportProblems problems) {
        Map<String, Employee> existing = loadExisting(rows);
        Set<String> seenInFile = new HashSet<>();
        Set<String> turningToLeft = new LinkedHashSet<>();
        ImportPlan plan = new ImportPlan();

        for (ImportRow row : rows) {
            String no = row.text(COL_NO);
            String type = row.text(COL_TYPE);
            String state = row.text(COL_STATE);
            boolean valid = true;

            if (!no.isEmpty() && !seenInFile.add(no)) {
                // 同一文件里出现两次同一个工号：两行都想成为这个人的最终值，而结果取决于处理顺序。
                // 覆盖语义的导入必须把它当错误——静默取最后一行会让运营以为两行都生效了
                problems.error(row, COL_NO, "文件内工号重复，同一个工号只能出现一行");
                valid = false;
            }
            if (!type.isEmpty() && !PERSON_TYPES.contains(type)) {
                problems.error(row, COL_TYPE, "只能填「讲师」「学员」或「两者」");
                valid = false;
            }
            if (!state.isEmpty() && !PERSON_STATES.contains(state)) {
                problems.error(row, COL_STATE, "只能填「在职」或「离职」");
                valid = false;
            }
            String email = row.text(COL_EMAIL);
            if (!email.isEmpty() && !EMAIL.matcher(email).matches()) {
                problems.error(row, COL_EMAIL, "邮箱格式不正确");
                valid = false;
            }
            if (!valid) {
                continue;
            }

            Employee current = existing.get(no);
            if (current != null && STATE_LEFT.equals(state) && !STATE_LEFT.equals(current.getPersonState())) {
                turningToLeft.add(no);
            }
            EmployeeForm form = new EmployeeForm(no, row.text(COL_NAME), row.text(COL_DEPT),
                    blankToNull(row.text(COL_POSITION)), blankToNull(email), type, state, null);
            if (current == null) {
                plan.insert(row, form);
            } else {
                plan.update(row, current.getId(), form);
            }
        }

        warnAboutOwners(rows, turningToLeft, plan, problems);
        return plan;
    }

    @Override
    public void write(ImportPlan plan, ImportRowWriter writer) {
        for (PlannedRow planned : plan.rows()) {
            EmployeeForm form = planned.payloadAs(EmployeeForm.class);
            // 批次号只在导入时落库，供整批撤销定位（需求 13.8.5）
            EmployeeForm stamped = new EmployeeForm(form.employeeNo(), form.employeeName(), form.deptName(),
                    form.position(), form.email(), form.personType(), form.personState(), writer.batchNo());

            if (planned.op() == RowOp.INSERT) {
                writer.insert(planned.rowNo(), TABLE, () -> {
                    Employee employee = new Employee();
                    employee.setEmployeeNo(stamped.employeeNo());
                    employee.setEmployeeName(stamped.employeeName());
                    employee.setDeptName(stamped.deptName());
                    employee.setPosition(stamped.position());
                    employee.setEmail(stamped.email());
                    employee.setPersonType(stamped.personType());
                    employee.setPersonState(stamped.personState());
                    employee.setImportBatchNo(stamped.importBatchNo());
                    employee.setCreatedBy(writer.operator());
                    employees.insert(employee);
                    return employee.getId();
                });
            } else if (planned.op() == RowOp.UPDATE) {
                writer.update(planned.rowNo(), TABLE, planned.targetId(),
                        () -> employees.updateAllFields(planned.targetId(), stamped, writer.operator()));
            }
        }
    }

    private Map<String, Employee> loadExisting(List<ImportRow> rows) {
        Set<String> nos = rows.stream()
                .map(row -> row.text(COL_NO))
                .filter(no -> !no.isEmpty())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (nos.isEmpty()) {
            return Map.of();
        }
        Map<String, Employee> byNo = new HashMap<>();
        for (Employee employee : employees.findByNos(nos)) {
            byNo.put(employee.getEmployeeNo(), employee);
        }
        return byNo;
    }

    /**
     * 需求 14.3：某人被改成「离职」而他还是某些对象的负责人时，给出警告清单，提示到配置中心
     * 批量转移负责人（13.9.4）。
     *
     * <p>是警告不是错误：离职是既成事实，拦住导入不会让人回来上班，只会让台账一直不准
     * （开发 5.6.3 细节六的判断标准）。
     */
    private void warnAboutOwners(List<ImportRow> rows, Set<String> turningToLeft,
                                 ImportPlan plan, ImportProblems problems) {
        if (turningToLeft.isEmpty()) {
            return;
        }
        Map<String, Long> owned = new HashMap<>();
        for (Map<String, Object> entry : ownedObjects.countOwnedObjects(turningToLeft)) {
            owned.put((String) entry.get("owner_no"), ((Number) entry.get("cnt")).longValue());
        }
        if (owned.isEmpty()) {
            return;
        }
        for (ImportRow row : rows) {
            Long count = owned.get(row.text(COL_NO));
            if (count != null) {
                problems.warning(row, COL_STATE,
                        "该人员转为离职，但仍负责 %d 个对象，请到配置中心批量转移负责人".formatted(count));
            }
        }
        plan.note("有 %d 名转离职人员仍在担任负责人，请到配置中心 · 负责人配置批量转移".formatted(owned.size()));
    }

    private static String blankToNull(String value) {
        return value.isEmpty() ? null : value;
    }
}
