package com.aiacademy.platform.people.controller;

import com.aiacademy.common.api.PageQuery;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 人员台账查询（需求 14.3）。
 *
 * <p><b>只有读接口。</b>需求第 14 章明确六类数据「全部由运营人员手工导入并维护」——台账的唯一
 * 写入口是人员导入。给它开一个 REST 写接口就多出一条绕过批次号的旁路：那样写进来的行没有
 * {@code import_batch_no}，撤销功能看不到它们，而运营会以为「导入进来的都能撤」。
 *
 * <p>本期没有人员台账页面（阶段 1 的三个页面是登录、导入中心、配置中心）。这几个接口现在就有
 * 消费方：阶段 2 起各处的负责人、讲师下拉都从这里取数，而它们要的排序（在职优先）与筛选
 * （按人员类型）属于台账自己的口径，不该由每个调用方各自拼。
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeService employees;

    public EmployeeController(EmployeeService employees) {
        this.employees = employees;
    }

    @GetMapping
    public R<PageResult<Employee>> list(@RequestParam(required = false) String keyword,
                                        @RequestParam(required = false) String dept,
                                        @RequestParam(required = false) String personType,
                                        @RequestParam(required = false) String personState,
                                        PageQuery page) {
        return R.ok(employees.list(keyword, dept, personType, personState, page));
    }

    @GetMapping("/{employeeNo}")
    public R<Employee> detail(@PathVariable String employeeNo) {
        return R.ok(employees.findByNo(employeeNo)
                .orElseThrow(() -> new NotFoundException("人员不存在或已删除：" + employeeNo)));
    }

    /** 部门下拉的可选值。V1.2 起部门是自由文本（N18），可选值只能从已录入的数据里归拢。 */
    @GetMapping("/depts")
    public R<List<String>> depts() {
        return R.ok(employees.deptNames());
    }
}
