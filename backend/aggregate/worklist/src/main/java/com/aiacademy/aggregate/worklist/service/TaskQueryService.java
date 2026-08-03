package com.aiacademy.aggregate.worklist.service;

import com.aiacademy.aggregate.worklist.domain.TaskListItem;
import com.aiacademy.aggregate.worklist.domain.TaskQuery;
import com.aiacademy.aggregate.worklist.repository.TaskQueryMapper;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 任务中心只读查询（AR-3）。逾期实时算，不落库。
 */
@Service
public class TaskQueryService {

    private final TaskQueryMapper tasks;

    public TaskQueryService(TaskQueryMapper tasks) {
        this.tasks = tasks;
    }

    @Transactional(readOnly = true)
    public PageResult<TaskListItem> page(TaskQuery query) {
        String pending = TaskStateMachine.STATE_PENDING;
        String inProgress = TaskStateMachine.STATE_IN_PROGRESS;
        long total = tasks.countPage(query, pending, inProgress);
        var records = tasks.selectPage(query, query.offset(), pending, inProgress);
        return PageResult.of(records, total, query);
    }
}
