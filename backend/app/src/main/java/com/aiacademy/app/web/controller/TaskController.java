package com.aiacademy.app.web.controller;

import com.aiacademy.aggregate.worklist.domain.TaskListItem;
import com.aiacademy.aggregate.worklist.domain.TaskQuery;
import com.aiacademy.aggregate.worklist.service.TaskQueryService;
import com.aiacademy.app.web.dto.TaskVO;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 任务中心最小读接口（阶段 3A／E3-5 后端一半）。
 *
 * <p>按负责人筛选用查询参数 {@code ownerNo}，<b>没有「我的任务」</b>（需求 AC3）。
 * 逾期由 SQL 实时表达式算出，不落库列。
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskQueryService tasks;

    public TaskController(TaskQueryService tasks) {
        this.tasks = tasks;
    }

    @GetMapping
    public R<PageResult<TaskVO>> list(TaskQuery query) {
        PageResult<TaskListItem> page = tasks.page(query);
        return R.ok(new PageResult<>(page.records().stream().map(TaskVO::of).toList(),
                page.total(), page.pageNum(), page.pageSize()));
    }
}
