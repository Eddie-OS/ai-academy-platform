package com.aiacademy.business.lecturer.service;

import com.aiacademy.business.lecturer.repository.LecturerImportMapper;
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
import com.aiacademy.platform.dict.service.DictQuery;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeImportSupport;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 讲师导入（需求 14.5）。唯一键工号：已存在则更新，不存在则新增入池。
 *
 * <p>前置条件是工号已在人员台账中（14.5 A 列），因此人员导入必须先做。
 *
 * <p>两处容易做错的地方：
 * <ul>
 *   <li><b>培养状态留空按「待培养」处理</b>（14.5 F 列、验收 A11-6）。它是必填列，但留空有明确的
 *       兜底值——这与其他必填列「留空即错误」不同，所以模板里把它标成必填、校验时又给默认值，
 *       两者不矛盾：必填是给运营的提示，默认值是给历史文件的兼容。
 *   <li><b>擅长领域查字典而不是查枚举</b>（13.9.3：作战单元不得硬编码为五个值）。
 * </ul>
 */
@Service
public class LecturerImportHandler implements ImportHandler {

    private static final String TABLE = "biz_lecturer";

    private static final String COL_EMPLOYEE = "工号";
    private static final String COL_NAME = "姓名";
    private static final String COL_DEPT = "来源部门";
    private static final String COL_DOMAINS = "擅长领域";
    private static final String COL_DIRECTION = "授课方向";
    private static final String COL_TRAINING_STATE = "培养状态";
    private static final String COL_POOL_STATE = "在池状态";

    /** 需求 14.5 D 列：多值用「;」分隔。 */
    private static final String DOMAIN_SEPARATOR = ";";

    private static final Set<String> TRAINING_STATES = Set.of("待培养", "培养中", "可上岗");
    private static final String DEFAULT_TRAINING_STATE = "待培养";
    private static final Set<String> POOL_STATES = Set.of("在池", "已移出");

    private final LecturerImportMapper mapper;
    private final EmployeeImportSupport employees;
    private final DictQuery dict;

    public LecturerImportHandler(LecturerImportMapper mapper, EmployeeImportSupport employees, DictQuery dict) {
        this.mapper = mapper;
        this.employees = employees;
        this.dict = dict;
    }

    @Override
    public ImportType type() {
        return ImportType.LECTURER;
    }

    @Override
    public ImportTemplateSpec template() {
        return new ImportTemplateSpec(ImportType.LECTURER, List.of(
                ImportColumn.required(COL_EMPLOYEE, 50, "≤50 字符，须在人员台账中存在，唯一键", "E0001"),
                ImportColumn.required(COL_NAME, 50, "≤50 字，以工号带出为准", "张三"),
                ImportColumn.required(COL_DEPT, 50, "≤50 字，自由文本", "客服中心"),
                ImportColumn.required(COL_DOMAINS, 200, "多值用「;」分隔，每个值须在作战单元字典中存在",
                        "课程;培训"),
                ImportColumn.required(COL_DIRECTION, 500, "≤500 字", "客服场景下的大模型应用"),
                ImportColumn.requiredWithDefault(COL_TRAINING_STATE, DEFAULT_TRAINING_STATE,
                        "待培养 / 培养中 / 可上岗，留空按「待培养」处理", "待培养"),
                ImportColumn.required(COL_POOL_STATE, "在池 / 已移出", "在池")),
                "工号已存在时更新，不存在时新增并入池。讲师ID由系统按 JS + 4 位流水生成。");
    }

    @Override
    public ImportPlan plan(List<ImportRow> rows, ImportProblems problems) {
        Map<String, Employee> people = employees.loadByColumn(rows, COL_EMPLOYEE);
        Map<String, Long> existing = new HashMap<>();
        if (!people.isEmpty()) {
            for (LecturerImportMapper.LecturerKey key : mapper.findByEmployeeNos(people.keySet())) {
                existing.put(key.employeeNo(), key.id());
            }
        }
        Set<String> combatUnits = dict.enabledNameSet(DictQuery.TYPE_COMBAT_UNIT);
        Set<String> seenInFile = new HashSet<>();
        ImportPlan plan = new ImportPlan();

        for (ImportRow row : rows) {
            String employeeNo = row.text(COL_EMPLOYEE);
            Employee employee = people.get(employeeNo);
            boolean valid = true;

            if (!employeeNo.isEmpty() && employee == null) {
                problems.error(row, COL_EMPLOYEE, EmployeeImportSupport.NOT_FOUND);
                valid = false;
            }
            if (!employeeNo.isEmpty() && !seenInFile.add(employeeNo)) {
                problems.error(row, COL_EMPLOYEE, "文件内工号重复，同一个工号只能出现一行");
                valid = false;
            }

            List<String> domains = splitDomains(row.text(COL_DOMAINS));
            for (String domain : domains) {
                if (!combatUnits.contains(domain)) {
                    problems.error(row, COL_DOMAINS, domain,
                            "「%s」不在作战单元字典中。当前可选：%s".formatted(domain, String.join("、", combatUnits)));
                    valid = false;
                }
            }

            // 留空已由框架按列声明的默认值填成「待培养」（需求 14.5 F 列、验收 A11-6）
            String trainingState = row.text(COL_TRAINING_STATE);
            if (!TRAINING_STATES.contains(trainingState)) {
                problems.error(row, COL_TRAINING_STATE, "只能填「待培养」「培养中」或「可上岗」");
                valid = false;
            }

            String poolState = row.text(COL_POOL_STATE);
            if (!poolState.isEmpty() && !POOL_STATES.contains(poolState)) {
                problems.error(row, COL_POOL_STATE, "只能填「在池」或「已移出」");
                valid = false;
            }
            if (!valid) {
                continue;
            }

            // 需求 14.5 B 列：姓名以工号带出为准，文件里的姓名只作参考
            LecturerWrite write = new LecturerWrite(employeeNo, employee.getEmployeeName(),
                    row.text(COL_DEPT), toJsonArray(domains), row.text(COL_DIRECTION),
                    trainingState, poolState);
            Long id = existing.get(employeeNo);
            if (id == null) {
                plan.insert(row, write);
            } else {
                plan.update(row, id, write);
            }
        }
        return plan;
    }

    @Override
    public void write(ImportPlan plan, ImportRowWriter writer) {
        // 讲师ID流水号：查一次当前最大值，本批次内自增。
        // 单实例部署 + 导入在一个事务里串行写，不需要序列或行锁；两个并发导入会撞唯一约束而整批回滚，
        // 那正是期望行为——批次撤销与重导比部分成功好处理。
        AtomicInteger seq = new AtomicInteger(mapper.maxLecturerSeq());
        LocalDate today = LocalDate.now();

        for (PlannedRow planned : plan.rows()) {
            LecturerWrite write = planned.payloadAs(LecturerWrite.class);

            if (planned.op() == RowOp.INSERT) {
                String lecturerNo = "JS%04d".formatted(seq.incrementAndGet());
                writer.insert(planned.rowNo(), TABLE, () -> mapper.insertLecturer(
                        lecturerNo, write.lecturerName(), write.employeeNo(), write.sourceDept(),
                        write.expertiseDomainsJson(), write.teachingDirection(), today,
                        write.trainingState(), write.poolState(), writer.batchNo(), writer.operator()));
            } else if (planned.op() == RowOp.UPDATE) {
                writer.update(planned.rowNo(), TABLE, planned.targetId(),
                        () -> mapper.updateLecturer(planned.targetId(), write.lecturerName(),
                                write.sourceDept(), write.expertiseDomainsJson(), write.teachingDirection(),
                                write.trainingState(), write.poolState(), writer.batchNo(), writer.operator()));
            }
        }
    }

    private record LecturerWrite(String employeeNo, String lecturerName, String sourceDept,
                                 String expertiseDomainsJson, String teachingDirection,
                                 String trainingState, String poolState) {
    }

    private static List<String> splitDomains(String raw) {
        List<String> domains = new ArrayList<>();
        for (String part : raw.split(DOMAIN_SEPARATOR)) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                domains.add(trimmed);
            }
        }
        return domains;
    }

    /**
     * 手写 JSON 数组而不引 Jackson：值来自作战单元字典，已逐个校验过在白名单内，不可能含引号或反斜杠。
     * 这一处的输入约束比引一个序列化库更可靠。
     */
    private static String toJsonArray(List<String> domains) {
        return domains.stream()
                .map(domain -> "\"" + domain + "\"")
                .collect(java.util.stream.Collectors.joining(",", "[", "]"));
    }
}
