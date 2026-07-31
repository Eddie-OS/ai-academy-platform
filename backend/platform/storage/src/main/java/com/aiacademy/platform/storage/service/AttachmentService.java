package com.aiacademy.platform.storage.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.storage.domain.Attachment;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import com.aiacademy.platform.storage.domain.AttachmentScene;
import com.aiacademy.platform.storage.domain.FileTypeRules;
import com.aiacademy.platform.storage.domain.StorageProperties;
import com.aiacademy.platform.storage.domain.UploadTicket;
import com.aiacademy.platform.storage.repository.AttachmentMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * 附件子系统（TD-7，规则 F1～F5、P5）。三段：申请上传 → 传分片 → 通知合并。
 *
 * <p>与导入一样是三段而不是一次 POST，原因写在开发 5.7.2：本地磁盘没有预签名 URL，200MB 必须
 * 流经应用服务器，而一次 POST 200MB 在断网时只能整份重传。分片之后续传只补缺失的片（P5）。
 *
 * <p><b>合并阶段的四件事，一件都不能省</b>（开发 5.7.2 要点表）：
 * <ol>
 *   <li>分片先写 tmp，合并后才进正式目录——否则「传了一半的文件」和正式文件混在一个目录里；
 *   <li>读文件头校验真实类型（规则 F2）——扩展名是可以随便改的；
 *   <li>合并走 {@code FileChannel.transferTo} 流式拷贝——200MB {@code readAllBytes} 会和
 *       PostgreSQL 抢内存；
 *   <li>限制并发合并数为 2——单机磁盘 IO 有限，合并是纯 IO 操作。
 * </ol>
 */
@Service
public class AttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

    private static final DateTimeFormatter MONTH_DIR = DateTimeFormatter.ofPattern("yyyyMM");

    /**
     * 全局并发合并数上限（开发 5.7.2 要点 4）。
     *
     * <p>2 不是随手写的数：合并是顺序读写大文件，并发起来只会让磁盘在几个文件之间来回寻道，
     * 总吞吐反而下降，同时把页缓存挤满，连带拖慢 PostgreSQL——同一台机器上只有一块盘。
     */
    private static final int MAX_CONCURRENT_MERGES = 2;

    /** 等不到合并许可就报错而不是无限等：让运营看到「稍后重试」，比页面转圈到超时好。 */
    private static final int MERGE_WAIT_SECONDS = 120;

    private final Semaphore mergePermits = new Semaphore(MAX_CONCURRENT_MERGES, true);

    private final AttachmentMapper attachments;
    private final ChunkUploadStore chunks;
    private final LocalFileStore files;

    public AttachmentService(AttachmentMapper attachments, ChunkUploadStore chunks, LocalFileStore files) {
        this.attachments = attachments;
        this.chunks = chunks;
        this.files = files;
    }

    // -------------------------------------------------------------------------
    // 第一步：申请上传
    // -------------------------------------------------------------------------

    /**
     * 申请上传（开发 5.7.2 第 1～3 步）：校验大小上限与扩展名白名单，返回 uploadId 与分片大小。
     *
     * <p>大小与扩展名在<b>传字节之前</b>就校验，是为了不让运营白等 200MB 的上传。
     * 它不能代替合并后的文件头校验：这里拿到的大小与文件名都是客户端说的。
     */
    public UploadTicket initUpload(String fileName, long fileSize, AttachmentScene scene,
                                   AttachmentOwnerType ownerType) {
        String safeName = LocalFileStore.sanitizeFileName(fileName);
        FileTypeRules.checkExtension(safeName);
        if (fileSize <= 0) {
            throw new BizException(ErrorCode.PARAM_INVALID, "文件大小必须大于 0");
        }
        if (fileSize > scene.maxBytes()) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "文件超过「%s」的上限 %s（规则 F1）".formatted(scene.label(), scene.maxSizeText()));
        }

        String uploadId = UUID.randomUUID().toString();
        int totalChunks = (int) ((fileSize + ChunkUploadStore.CHUNK_SIZE - 1) / ChunkUploadStore.CHUNK_SIZE);
        chunks.writeManifest(uploadId, new ChunkUploadStore.Manifest(
                safeName, fileSize, scene, ownerType, totalChunks));
        return new UploadTicket(uploadId, ChunkUploadStore.CHUNK_SIZE, totalChunks, List.of());
    }

    /** 续传前查已传了哪些片（规则 P5）。前端只补缺的那几片。 */
    public UploadTicket uploadStatus(String uploadId) {
        ChunkUploadStore.Manifest manifest = chunks.readManifest(uploadId);
        return new UploadTicket(uploadId, ChunkUploadStore.CHUNK_SIZE, manifest.totalChunks(),
                chunks.uploadedChunks(uploadId));
    }

    // -------------------------------------------------------------------------
    // 第二步：传分片
    // -------------------------------------------------------------------------

    /**
     * 写一个分片（开发 5.7.2 第 4～5 步）。同一序号重传直接覆盖——续传允许重传边界上的那一片。
     *
     * @return 写入的字节数
     */
    public long uploadChunk(String uploadId, int index, InputStream content) {
        ChunkUploadStore.Manifest manifest = chunks.readManifest(uploadId);
        if (index >= manifest.totalChunks()) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "分片序号越界：共 %d 片，收到序号 %d".formatted(manifest.totalChunks(), index));
        }
        return files.write(chunks.chunkPath(uploadId, index), content);
    }

    // -------------------------------------------------------------------------
    // 第三步：合并
    // -------------------------------------------------------------------------

    /**
     * 通知合并（开发 5.7.2 第 6～9 步）：合并 → 校验真实类型 → 落元数据。
     *
     * <p>合并出来的文件先移进正式目录再写元数据行。反过来（先写行后移文件）在移动失败时会留下
     * 一条指向不存在文件的元数据，而它有 {@code created_at}，孤儿清理会把它当正常附件放过
     * ——下载时才发现文件没了。
     */
    public Attachment complete(String uploadId) {
        ChunkUploadStore.Manifest manifest = chunks.readManifest(uploadId);
        List<Integer> uploaded = chunks.uploadedChunks(uploadId);
        List<Integer> missing = new ArrayList<>();
        for (int i = 0; i < manifest.totalChunks(); i++) {
            if (!uploaded.contains(i)) {
                missing.add(i);
            }
        }
        if (!missing.isEmpty()) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "还有 %d 个分片没有上传：%s（规则 P5：只需补传缺失的分片）"
                            .formatted(missing.size(), missing.size() > 20 ? missing.subList(0, 20) + "…" : missing));
        }

        Path merged = chunks.mergedPath(uploadId);
        long size = mergeWithPermit(uploadId, manifest, merged);

        // 第 8 步：真实类型校验（规则 F2）。不通过就连文件一起删掉，不留在磁盘上
        try {
            FileTypeRules.checkMagicNumber(manifest.fileName(), readHeader(merged));
        } catch (RuntimeException e) {
            chunks.discard(uploadId);
            throw e;
        }
        if (size > manifest.scene().maxBytes()) {
            // 申请时报的大小可以撒谎，合并后的实际大小不会
            chunks.discard(uploadId);
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "文件实际大小超过「%s」的上限 %s（规则 F1）"
                            .formatted(manifest.scene().label(), manifest.scene().maxSizeText()));
        }

        String sha256 = sha256(merged);
        long id = attachments.nextId();
        Path target = storagePathOf(id, manifest);
        files.move(merged, target);

        String storagePath = target.toString().replace('\\', '/');
        try {
            // 单条 INSERT，不需要显式事务；也不能开事务——合并与移动文件是不可回滚的磁盘操作，
            // 把它们包进事务只会造出「事务回滚了但文件已经移走」的错觉
            attachments.insert(id, manifest.fileName(), size,
                    FileTypeRules.contentTypeOf(manifest.fileName()), storagePath, sha256, operator());
        } catch (RuntimeException e) {
            // 元数据没写成，文件就不该留着：它不在任何表里，清理任务永远看不到它
            files.deletePhysically(target);
            throw e;
        }
        chunks.discard(uploadId);

        log.info("附件 {} 上传完成：{}，{} 字节，路径 {}", id, manifest.fileName(), size, storagePath);
        return attachments.findById(id);
    }

    // -------------------------------------------------------------------------
    // 下载与删除
    // -------------------------------------------------------------------------

    /**
     * 取附件用于下载（规则 F3）。<b>登录态由接口层保证</b>，这里只挡逻辑删除。
     *
     * <p>返回流而不是字节数组：两三个人同时下 200MB 就能把 2G 堆打满（开发 5.7.3）。
     */
    public DownloadableAttachment download(long id) {
        Attachment attachment = require(id);
        if (attachment.deleted()) {
            throw new NotFoundException("附件已删除：" + id);
        }
        Path path = Path.of(attachment.storagePath());
        if (!files.exists(path)) {
            throw new NotFoundException("附件文件不存在：" + attachment.storagePath());
        }
        return new DownloadableAttachment(attachment, files.open(path));
    }

    /** @param content 调用方负责关闭 */
    public record DownloadableAttachment(Attachment meta, InputStream content) {
    }

    /** 逻辑删除（规则 F5）。文件与元数据行都留着，历史评审记录仍能下载到同一个文件对象。 */
    @Transactional
    public void delete(long id) {
        require(id);
        attachments.markDeleted(id, operator());
    }

    public Attachment require(long id) {
        Attachment attachment = attachments.findById(id);
        if (attachment == null) {
            throw new NotFoundException("附件不存在：" + id);
        }
        return attachment;
    }

    // -------------------------------------------------------------------------
    // 引用关系（开发 5.7.2 第 10 步）
    // -------------------------------------------------------------------------

    /**
     * 业务保存时把附件关联到对象（开发 5.7.2 第 10 步）。
     *
     * <p>先上传后关联是这套流程的设计前提，代价是「上传了但没保存表单」的孤儿附件，
     * 由 {@link AttachmentCleanupJob} 兜底。
     */
    @Transactional
    public void link(long attachmentId, AttachmentOwnerType refType, long refId, String refField, int seqNo) {
        require(attachmentId);
        attachments.linkRef(attachmentId, refType.name(), refId, refField, seqNo, operator());
    }

    @Transactional
    public void unlink(long attachmentId, AttachmentOwnerType refType, long refId, String refField) {
        attachments.unlinkRef(attachmentId, refType.name(), refId, refField, operator());
    }

    public List<Attachment> listOf(AttachmentOwnerType refType, long refId, String refField) {
        return attachments.findByRef(refType.name(), refId, refField);
    }

    // -------------------------------------------------------------------------
    // 内部
    // -------------------------------------------------------------------------

    private long mergeWithPermit(String uploadId, ChunkUploadStore.Manifest manifest, Path merged) {
        boolean acquired;
        try {
            acquired = mergePermits.tryAcquire(MERGE_WAIT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.INTERNAL_ERROR, "合并被中断，请重试");
        }
        if (!acquired) {
            throw new BizException(ErrorCode.INTERNAL_ERROR, "当前上传合并任务过多，请稍后重试");
        }
        try {
            List<Path> parts = new ArrayList<>(manifest.totalChunks());
            for (int i = 0; i < manifest.totalChunks(); i++) {
                parts.add(chunks.chunkPath(uploadId, i));
            }
            return files.merge(parts, merged);
        } finally {
            mergePermits.release();
        }
    }

    /** 开发 5.7.3 的路径规则：{@code attachment/{业务对象类型}/{yyyyMM}/{附件ID}_{原始文件名}}。 */
    private Path storagePathOf(long id, ChunkUploadStore.Manifest manifest) {
        return StorageProperties.attachmentDir()
                .resolve(manifest.ownerType().directory())
                .resolve(YearMonth.now().format(MONTH_DIR))
                .resolve(id + "_" + manifest.fileName());
    }

    private byte[] readHeader(Path path) {
        try (InputStream in = files.open(path)) {
            byte[] header = new byte[FileTypeRules.HEADER_BYTES];
            int read = in.readNBytes(header, 0, header.length);
            if (read < header.length) {
                // 比文件头还短的文件不可能是白名单里的任何格式
                byte[] shorter = new byte[read];
                System.arraycopy(header, 0, shorter, 0, read);
                return shorter;
            }
            return header;
        } catch (IOException e) {
            throw new UncheckedIOException("读取文件头失败：" + path, e);
        }
    }

    /** 流式算摘要：200MB 不进内存（规则 F1 的上限就是为它定的）。 */
    private String sha256(Path path) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream in = files.open(path);
                 DigestInputStream digestIn = new DigestInputStream(in, digest)) {
                byte[] buffer = new byte[64 * 1024];
                while (digestIn.read(buffer) != -1) {
                    // 只为推进摘要
                }
            }
            StringBuilder hex = new StringBuilder(64);
            for (byte b : digest.digest()) {
                hex.append("%02x".formatted(b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException | IOException e) {
            throw new IllegalStateException("计算文件摘要失败：" + path, e);
        }
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
