package com.aiacademy.app.schedule;

import com.aiacademy.platform.storage.service.AttachmentCleanupJob;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 附件清理调度桥接：写 {@code sys_job_run_log}，避免 platform 依赖 app。
 *
 * <p>当前假设单实例部署，多实例需引入分布式锁。
 */
@Component
public class AttachmentCleanupJobBridge {

    private final AttachmentCleanupJob job;
    private final JobRunLogger jobLogs;

    public AttachmentCleanupJobBridge(AttachmentCleanupJob job, JobRunLogger jobLogs) {
        this.job = job;
        this.jobLogs = jobLogs;
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void runDaily() {
        jobLogs.run("attachment-cleanup", () -> {
            job.runDaily();
            return "ok";
        });
    }
}
