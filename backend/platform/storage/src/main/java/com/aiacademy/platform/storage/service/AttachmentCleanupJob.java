package com.aiacademy.platform.storage.service;

import com.aiacademy.platform.storage.domain.Attachment;
import com.aiacademy.platform.storage.domain.StorageProperties;
import com.aiacademy.platform.storage.repository.AttachmentMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 孤儿附件与 tmp 分片清理，每日 3:00（开发 5.7.2 末段、5.11.1 定时任务表）。
 *
 * <p><b>在单机部署下这不是可选项。</b>附件是「先上传、后关联业务对象」，因此必然产生两类垃圾：
 * 上传了但表单没保存的孤儿附件，以及上传中断留在 tmp 的分片。没有清理任务，反复上传失败会把盘写满，
 * 而<b>写满磁盘会同时让 PostgreSQL 停止工作</b>——同一块盘上既有附件也有数据库。
 *
 * <p>两类垃圾都物理删除，这与规则 F5「附件逻辑删除」不冲突：F5 保护的是被业务引用过的附件
 * （历史评审记录还要能下载它）。这里删的是从未被任何对象引用的文件。
 *
 * <p>当前假设单实例部署，多实例需引入分布式锁。执行日志由 app 模块的包装任务写入
 * {@code sys_job_run_log}（见 {@code AttachmentCleanupJobBridge}）。
 */
@Component
public class AttachmentCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(AttachmentCleanupJob.class);

    /** 开发 5.7.2：超过 24 小时。给的是「运营填完一个长表单」的宽裕余量。 */
    private static final Duration GRACE = Duration.ofHours(24);

    private final AttachmentMapper attachments;
    private final LocalFileStore files;

    public AttachmentCleanupJob(AttachmentMapper attachments, LocalFileStore files) {
        this.attachments = attachments;
        this.files = files;
    }

    /**
     * 保留给测试直接调用。生产调度入口在 app 的 {@code AttachmentCleanupJobBridge}，
     * 以便写 {@code sys_job_run_log} 且不让 platform 依赖 app。
     */
    public void runDaily() {
        CleanupResult result = cleanup(OffsetDateTime.now().minus(GRACE));
        log.info("附件清理完成：孤儿附件 {} 个、tmp 分片目录 {} 个",
                result.orphanAttachments(), result.tmpDirectories());
    }

    /**
     * @param before 早于这个时间的才清理
     * @return 清理数量，供测试与日志
     */
    public CleanupResult cleanup(OffsetDateTime before) {
        return new CleanupResult(cleanOrphanAttachments(before), cleanTmpDirectories(before));
    }

    public record CleanupResult(int orphanAttachments, int tmpDirectories) {
    }

    private int cleanOrphanAttachments(OffsetDateTime before) {
        List<Attachment> orphans = attachments.findOrphans(before);
        int cleaned = 0;
        for (Attachment orphan : orphans) {
            // 先删元数据行再删文件：反过来若删文件后进程挂掉，库里会留一条指向不存在文件的记录，
            // 而它已经「没有引用」，下一轮清理会再来一次——每轮都失败在同一行上
            attachments.purge(orphan.id());
            files.deletePhysically(Path.of(orphan.storagePath()));
            cleaned++;
            log.info("清理孤儿附件 {}：{}（上传于 {} 且从未被任何对象引用）",
                    orphan.id(), orphan.fileName(), orphan.createdAt());
        }
        return cleaned;
    }

    private int cleanTmpDirectories(OffsetDateTime before) {
        Path tmpRoot = files.properties().rootPath().resolve(StorageProperties.tmpDir());
        if (!Files.isDirectory(tmpRoot)) {
            return 0;
        }
        int cleaned = 0;
        try (var list = Files.list(tmpRoot)) {
            for (Path dir : list.toList()) {
                if (!Files.isDirectory(dir) || !isOlderThan(dir, before)) {
                    continue;
                }
                files.deleteDirectory(StorageProperties.tmpDir().resolve(dir.getFileName().toString()));
                cleaned++;
                log.info("清理未合并的分片目录 {}", dir.getFileName());
            }
        } catch (IOException e) {
            throw new UncheckedIOException("扫描 tmp 目录失败", e);
        }
        return cleaned;
    }

    /**
     * 用<b>最后修改时间</b>而不是创建时间判断：正在续传的上传任务每传一片都会更新目录时间，
     * 一个断网两天、今天又接着传的任务不该在半夜被清掉。
     */
    private boolean isOlderThan(Path dir, OffsetDateTime before) {
        try {
            return Files.getLastModifiedTime(dir).toInstant().isBefore(before.toInstant());
        } catch (IOException e) {
            throw new UncheckedIOException("读取目录时间失败：" + dir, e);
        }
    }
}
