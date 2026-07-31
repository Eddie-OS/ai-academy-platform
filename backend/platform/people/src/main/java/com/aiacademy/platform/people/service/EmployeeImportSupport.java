package com.aiacademy.platform.people.service;

import com.aiacademy.platform.dataimport.domain.ImportRow;
import com.aiacademy.platform.people.domain.Employee;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 五类导入共用的工号解析（签到、参训名单、讲师、学员反馈、试讲反馈）。
 *
 * <p>抽出来的理由不是省几行代码，是<b>统一口径</b>：这五类导入对「工号不存在」的处理必须一致
 * （都是错误、都是同一句提示），对「姓名以工号为准」也必须一致（需求 14.4 C 列、14.5 B 列都写了
 * 「以工号带出为准」）。分散在五个 Handler 里迟早会有一个写成警告或者以文件里的姓名为准。
 *
 * <p>放在 platform/people 而不是导入框架里：框架不认识人员台账，而 people 模块本来就依赖
 * 导入框架（人员导入 Handler 在这里），反过来依赖会让 Gradle 出现循环。
 */
@Service
public class EmployeeImportSupport {

    /** 工号不存在的统一提示。五类导入共用，改文案改这一处。 */
    public static final String NOT_FOUND = "工号在人员台账中不存在，请先导入人员";

    private final EmployeeService employees;

    public EmployeeImportSupport(EmployeeService employees) {
        this.employees = employees;
    }

    /** 把文件里某一列的全部工号一次查出来，返回「工号 → 人员」。 */
    public Map<String, Employee> loadByColumn(List<ImportRow> rows, String column) {
        Set<String> nos = new LinkedHashSet<>();
        for (ImportRow row : rows) {
            String no = row.text(column);
            if (!no.isEmpty()) {
                nos.add(no);
            }
        }
        return employees.findByNos(nos);
    }
}
