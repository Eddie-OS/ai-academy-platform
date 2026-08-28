package com.aiacademy.app.schedule;

import com.aiacademy.app.repository.JobRunLogMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.function.Supplier;

/**
 * 定时任务执行日志（开发 5.11.1）。每次执行写 {@code sys_job_run_log}。
 */
@Component
public class JobRunLogger {

    private static final Logger log = LoggerFactory.getLogger(JobRunLogger.class);

    private final JobRunLogMapper logs;

    public JobRunLogger(JobRunLogMapper logs) {
        this.logs = logs;
    }

    public void run(String jobName, Supplier<String> action) {
        OffsetDateTime start = OffsetDateTime.now();
        try {
            String message = action.get();
            logs.insert(jobName, start, OffsetDateTime.now(), true, message);
        } catch (Exception ex) {
            log.error("定时任务失败：{}", jobName, ex);
            try {
                logs.insert(jobName, start, OffsetDateTime.now(), false,
                        ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
            } catch (Exception logEx) {
                log.error("写任务日志失败：{}", jobName, logEx);
            }
            // 不向上抛：避免打挂调度线程；失败已落库
        }
    }
}
