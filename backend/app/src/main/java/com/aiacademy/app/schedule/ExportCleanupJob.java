package com.aiacademy.app.schedule;

import com.aiacademy.app.export.ExportTask;
import com.aiacademy.app.repository.ExportTaskMapper;
import com.aiacademy.platform.storage.domain.StorageProperties;
import com.aiacademy.platform.storage.service.LocalFileStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;

/**
 * 导出文件清理，每日 3:30（开发 5.11.1／5.11.2）。
 *
 * <p>当前假设单实例部署，多实例需引入分布式锁。
 */
@Component
public class ExportCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(ExportCleanupJob.class);
    private static final long MAX_DIR_BYTES = 5L * 1024 * 1024 * 1024;

    private final ExportTaskMapper tasks;
    private final LocalFileStore files;
    private final JobRunLogger jobLogs;

    public ExportCleanupJob(ExportTaskMapper tasks, LocalFileStore files, JobRunLogger jobLogs) {
        this.tasks = tasks;
        this.files = files;
        this.jobLogs = jobLogs;
    }

    @Scheduled(cron = "0 30 3 * * *")
    public void runDaily() {
        jobLogs.run("export-cleanup", () -> {
            try {
                return cleanup();
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
        });
    }

    String cleanup() throws IOException {
        int expired = 0;
        for (ExportTask task : tasks.findExpired()) {
            if (task.storagePath() != null) {
                Path abs = files.properties().rootPath().resolve(task.storagePath());
                Files.deleteIfExists(abs);
            }
            tasks.softDelete(task.id());
            expired++;
        }
        int sizeTrimmed = trimBySize();
        String msg = "过期 " + expired + "，体积兜底删除 " + sizeTrimmed;
        log.info("导出清理完成：{}", msg);
        return msg;
    }

    private int trimBySize() throws IOException {
        Path dir = files.properties().rootPath().resolve(StorageProperties.exportDir());
        if (!Files.isDirectory(dir)) {
            return 0;
        }
        long total;
        try (Stream<Path> walk = Files.list(dir)) {
            total = walk.filter(Files::isRegularFile).mapToLong(p -> {
                try {
                    return Files.size(p);
                } catch (IOException e) {
                    return 0L;
                }
            }).sum();
        }
        if (total <= MAX_DIR_BYTES) {
            return 0;
        }
        int deleted = 0;
        try (Stream<Path> walk = Files.list(dir)) {
            var filesOldestFirst = walk.filter(Files::isRegularFile)
                    .sorted(Comparator.comparingLong(p -> {
                        try {
                            return Files.getLastModifiedTime(p).toMillis();
                        } catch (IOException e) {
                            return 0L;
                        }
                    }))
                    .toList();
            for (Path file : filesOldestFirst) {
                if (total <= MAX_DIR_BYTES) {
                    break;
                }
                long size = Files.size(file);
                Files.deleteIfExists(file);
                total -= size;
                deleted++;
            }
        }
        return deleted;
    }
}
