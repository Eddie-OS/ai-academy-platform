package com.aiacademy.app.storage;

import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.storage.domain.Attachment;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import com.aiacademy.platform.storage.domain.AttachmentScene;
import com.aiacademy.platform.storage.domain.StorageProperties;
import com.aiacademy.platform.storage.domain.UploadTicket;
import com.aiacademy.platform.storage.service.AttachmentCleanupJob;
import com.aiacademy.platform.storage.service.AttachmentService;
import com.aiacademy.platform.storage.service.ChunkUploadStore;
import com.aiacademy.platform.storage.service.LocalFileStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 附件子系统（TD-7）：分片上传、真实类型校验、流式下载、引用关系、孤儿与 tmp 清理。
 * 覆盖规则 F1～F5 与 P5。
 */
class AttachmentIntegrationTest extends IntegrationTest {

    /** 真 PNG 的文件头（89 50 4E 47 0D 0A 1A 0A），后面跟点内容凑长度。 */
    private static final byte[] PNG_HEADER = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};

    /** zip／OOXML 的文件头 PK\3\4。docx、xlsx、pptx 都是 zip 容器。 */
    private static final byte[] ZIP_HEADER = {0x50, 0x4B, 0x03, 0x04};

    /** Windows 可执行文件头 MZ——白名单里的任何格式都不长这样。 */
    private static final byte[] EXE_HEADER = {0x4D, 0x5A, (byte) 0x90, 0x00};

    @Autowired
    private AttachmentService attachments;

    @Autowired
    private AttachmentCleanupJob cleanup;

    @Autowired
    private LocalFileStore files;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    // -------------------------------------------------------------------------
    // 上传主流程
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("分片上传 → 合并 → 元数据落库，存储路径按「对象类型/年月/ID_原名」（开发 5.7.3）")
    void 上传合并与路径规则() {
        byte[] content = 造文件(ZIP_HEADER, 3000);

        Attachment attachment = 上传(content, "第三章课件.pptx",
                AttachmentScene.COURSEWARE, AttachmentOwnerType.COURSE);

        assertThat(attachment.fileName()).isEqualTo("第三章课件.pptx");
        assertThat(attachment.fileSize()).isEqualTo(content.length);
        assertThat(attachment.contentType())
                .isEqualTo("application/vnd.openxmlformats-officedocument.presentationml.presentation");
        assertThat(attachment.storagePath())
                .describedAs("开发 5.7.3：按月份分目录，避免单目录文件过多；保留原始文件名，"
                        + "以便数据库损坏时还能人工从磁盘认出文件")
                .isEqualTo("attachment/course/%s/%d_第三章课件.pptx"
                        .formatted(YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM")),
                                attachment.id()));
        assertThat(attachment.storagePath())
                .describedAs("规则 F4／开发 6.3.8：库里存相对路径。存绝对路径的话，"
                        + "挂载点从 /data 换成 /mnt/data 就得 UPDATE 全表")
                .doesNotContain(":").doesNotStartWith("/");
        assertThat(files.exists(Path.of(attachment.storagePath()))).isTrue();
        assertThat(attachment.sha256()).hasSize(64);
    }

    @Test
    @DisplayName("下载返回的是流式内容，且与上传的字节完全一致")
    void 下载内容一致() throws IOException {
        byte[] content = 造文件(PNG_HEADER, 12345);
        Attachment attachment = 上传(content, "封面.png", AttachmentScene.GENERAL, AttachmentOwnerType.CASE);

        AttachmentService.DownloadableAttachment download = attachments.download(attachment.id());
        try (InputStream in = download.content()) {
            assertThat(in.readAllBytes()).isEqualTo(content);
        }
        assertThat(download.meta().fileName()).isEqualTo("封面.png");
    }

    @Test
    @DisplayName("同样内容两次上传得到同一个 sha256（秒传与去重的前提）")
    void 摘要可用于去重() {
        byte[] content = 造文件(PNG_HEADER, 999);

        Attachment first = 上传(content, "a.png", AttachmentScene.GENERAL, AttachmentOwnerType.CASE);
        Attachment second = 上传(content, "b.png", AttachmentScene.GENERAL, AttachmentOwnerType.CASE);

        assertThat(second.sha256()).isEqualTo(first.sha256());
        assertThat(second.id()).isNotEqualTo(first.id());
    }

    @Test
    @DisplayName("原始文件名里的路径穿越被剔除，文件老实待在附件目录下")
    void 文件名路径穿越() {
        Attachment attachment = 上传(造文件(PNG_HEADER, 100), "../../../etc/passwd.png",
                AttachmentScene.GENERAL, AttachmentOwnerType.CASE);

        assertThat(attachment.storagePath())
                .describedAs("开发 5.7.3 明确要求过滤 ..、/、\\；"
                        + "LocalFileStore.resolve 是第二道防线，两道都要有")
                .doesNotContain("..")
                .startsWith("attachment/case/");
        assertThat(files.exists(Path.of(attachment.storagePath()))).isTrue();
    }

    // -------------------------------------------------------------------------
    // 规则 F2：真实类型
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("F2：改了扩展名的可执行文件被拒，文件与元数据都不留")
    void 伪造扩展名被拒() {
        UploadTicket ticket = attachments.initUpload("课件.pptx", 400,
                AttachmentScene.COURSEWARE, AttachmentOwnerType.COURSE);
        attachments.uploadChunk(ticket.uploadId(), 0,
                new ByteArrayInputStream(造文件(EXE_HEADER, 400)));

        assertThatThrownBy(() -> attachments.complete(ticket.uploadId()))
                .describedAs("规则 F2、开发 5.7.2 第 8 步：只看扩展名的校验会放行它，"
                        + "而这个文件会长期躺在服务器上等着被谁点开")
                .isInstanceOf(BizException.class)
                .hasMessageContaining("真实类型与扩展名不符");

        assertThat(files.exists(临时目录(ticket.uploadId())))
                .describedAs("检测失败时要删掉文件，不能留在磁盘上")
                .isFalse();
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM sys_attachment WHERE file_name = '课件.pptx'", Integer.class))
                .isZero();
    }

    @Test
    @DisplayName("F2 反向对照：内容确实是 zip 容器的 pptx 正常通过")
    void 真实的OOXML通过() {
        Attachment attachment = 上传(造文件(ZIP_HEADER, 500), "真课件.pptx",
                AttachmentScene.COURSEWARE, AttachmentOwnerType.COURSE);

        assertThat(attachment.id()).isPositive();
    }

    @Test
    @DisplayName("F2：白名单之外的扩展名在申请阶段就被拒，不用先传 200MB")
    void 扩展名白名单() {
        assertThatThrownBy(() -> attachments.initUpload("演示.mp4", 1024,
                AttachmentScene.COURSEWARE, AttachmentOwnerType.COURSE))
                .describedAs("需求 F2／N22：V1.2 移除 mp4/mov，视频一律填外部链接")
                .isInstanceOf(BizException.class)
                .hasMessageContaining("不支持的文件格式");
    }

    // -------------------------------------------------------------------------
    // 规则 F1：分场景大小上限
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("F1：普通附件 20MB、课件 200MB，上限按场景而不是全局配置")
    void 分场景大小上限() {
        long 二十一MB = 21L * 1024 * 1024;

        assertThatThrownBy(() -> attachments.initUpload("大附件.pdf", 二十一MB,
                AttachmentScene.GENERAL, AttachmentOwnerType.DEMAND))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("20MB");

        assertThat(attachments.initUpload("大课件.pptx", 二十一MB,
                AttachmentScene.COURSEWARE, AttachmentOwnerType.COURSE).uploadId())
                .describedAs("同样大小的文件在课件场景是合法的——做成全局上限，"
                        + "要么课件传不上去，要么需求描述也能塞 200MB 压缩包")
                .isNotBlank();

        assertThatThrownBy(() -> attachments.initUpload("超大课件.pptx", 201L * 1024 * 1024,
                AttachmentScene.COURSEWARE, AttachmentOwnerType.COURSE))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("200MB");
    }

    @Test
    @DisplayName("F1：申请时报小、实际传大的文件在合并后被拦下")
    void 实际大小也要校验() {
        // 申请说 100 字节，实际传 200 字节：客户端说的大小不能作为唯一依据
        UploadTicket ticket = attachments.initUpload("图.png", 100,
                AttachmentScene.GENERAL, AttachmentOwnerType.CASE);
        attachments.uploadChunk(ticket.uploadId(), 0, new ByteArrayInputStream(造文件(PNG_HEADER, 200)));

        Attachment attachment = attachments.complete(ticket.uploadId());

        assertThat(attachment.fileSize())
                .describedAs("元数据记的必须是实际字节数，而不是申请时客户端报的数字")
                .isEqualTo(200);
    }

    // -------------------------------------------------------------------------
    // 规则 P5：断点续传
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("P5：分片可以分次传，续传时只补缺失的片")
    void 断点续传() {
        byte[] content = 造文件(PNG_HEADER, ChunkUploadStore.CHUNK_SIZE * 2 + 100);
        UploadTicket ticket = attachments.initUpload("大图.png", content.length,
                AttachmentScene.GENERAL, AttachmentOwnerType.CASE);
        assertThat(ticket.totalChunks()).isEqualTo(3);

        // 只传第 0 片和第 2 片，第 1 片「断网了」
        传片(ticket.uploadId(), 0, content);
        传片(ticket.uploadId(), 2, content);

        UploadTicket status = attachments.uploadStatus(ticket.uploadId());
        assertThat(status.uploadedChunks())
                .describedAs("规则 P5：前端靠这个清单知道该补哪几片，而不是从头再传 200MB")
                .containsExactly(0, 2);

        assertThatThrownBy(() -> attachments.complete(ticket.uploadId()))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("[1]");

        传片(ticket.uploadId(), 1, content);
        Attachment attachment = attachments.complete(ticket.uploadId());

        assertThat(attachment.fileSize())
                .describedAs("合并要按序号顺序拼，乱序拼出来的文件大小正确但内容全坏")
                .isEqualTo(content.length);
        try (InputStream in = attachments.download(attachment.id()).content()) {
            assertThat(in.readAllBytes()).isEqualTo(content);
        } catch (IOException e) {
            throw new AssertionError(e);
        }
    }

    @Test
    @DisplayName("合并成功后 tmp 分片目录立即清空，不等每日清理")
    void 合并后清理临时目录() {
        byte[] content = 造文件(PNG_HEADER, 100);
        UploadTicket ticket = attachments.initUpload("小图.png", content.length,
                AttachmentScene.GENERAL, AttachmentOwnerType.CASE);
        传片(ticket.uploadId(), 0, content);
        assertThat(files.exists(临时目录(ticket.uploadId()))).isTrue();

        attachments.complete(ticket.uploadId());

        assertThat(files.exists(临时目录(ticket.uploadId())))
                .describedAs("分片合并后就是垃圾。留到半夜的清理任务，等于让磁盘白占一天——"
                        + "200MB 的课件传十次就是 2GB")
                .isFalse();
    }

    // -------------------------------------------------------------------------
    // 规则 F5：逻辑删除
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("F5：删除是逻辑删除，下载不到但文件与元数据都还在")
    void 逻辑删除不动文件() {
        Attachment attachment = 上传(造文件(PNG_HEADER, 100), "会被删的图.png",
                AttachmentScene.GENERAL, AttachmentOwnerType.CASE);

        attachments.delete(attachment.id());

        assertThatThrownBy(() -> attachments.download(attachment.id()))
                .isInstanceOf(NotFoundException.class);
        assertThat(files.exists(Path.of(attachment.storagePath())))
                .describedAs("规则 F5：物理删除会破坏 R7 的材料版本快照——"
                        + "历史评审记录引用的是同一个文件对象")
                .isTrue();
        assertThat(jdbc.queryForObject("SELECT deleted FROM sys_attachment WHERE id = ?",
                Boolean.class, attachment.id())).isTrue();
    }

    // -------------------------------------------------------------------------
    // 引用关系与清理（TD-7.2、TD-11）
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("附件按「对象 + 字段」关联，同一附件可被多处引用（R7 版本快照的前提）")
    void 引用关系() {
        Attachment attachment = 上传(造文件(ZIP_HEADER, 100), "课件v1.pptx",
                AttachmentScene.COURSEWARE, AttachmentOwnerType.COURSE);

        attachments.link(attachment.id(), AttachmentOwnerType.COURSE, 100, "material_current", 0);
        attachments.link(attachment.id(), AttachmentOwnerType.COURSE_REVIEW, 200, "material_snapshot", 0);

        assertThat(attachments.listOf(AttachmentOwnerType.COURSE, 100, "material_current"))
                .extracting(Attachment::id).containsExactly(attachment.id());
        assertThat(attachments.listOf(AttachmentOwnerType.COURSE_REVIEW, 200, "material_snapshot"))
                .describedAs("一个附件被两处引用，这正是附件表不能带 course_id 的原因（开发 6.3.8）")
                .hasSize(1);

        attachments.unlink(attachment.id(), AttachmentOwnerType.COURSE, 100, "material_current");
        assertThat(attachments.listOf(AttachmentOwnerType.COURSE, 100, "material_current")).isEmpty();
        assertThat(attachments.listOf(AttachmentOwnerType.COURSE_REVIEW, 200, "material_snapshot"))
                .describedAs("解除一处引用不影响另一处")
                .hasSize(1);
    }

    @Test
    @DisplayName("TD-7.2：超过 24 小时仍没被任何对象引用的附件，文件与元数据一起物理清理")
    void 清理孤儿附件() {
        Attachment 孤儿 = 上传(造文件(PNG_HEADER, 100), "没保存表单.png",
                AttachmentScene.GENERAL, AttachmentOwnerType.CASE);
        Attachment 已引用 = 上传(造文件(PNG_HEADER, 100), "已关联.png",
                AttachmentScene.GENERAL, AttachmentOwnerType.CASE);
        attachments.link(已引用.id(), AttachmentOwnerType.CASE, 300, "case_files", 0);
        往前挪时间(孤儿.id(), 已引用.id());

        AttachmentCleanupJob.CleanupResult result = cleanup.cleanup(OffsetDateTime.now().minusHours(24));

        assertThat(result.orphanAttachments()).isPositive();
        assertThat(files.exists(Path.of(孤儿.storagePath())))
                .describedAs("开发 5.7.2：单机部署下这个任务不是可选项——"
                        + "反复上传失败会把盘写满，而写满磁盘会同时让 PostgreSQL 停止工作")
                .isFalse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sys_attachment WHERE id = ?",
                Integer.class, 孤儿.id())).isZero();

        assertThat(files.exists(Path.of(已引用.storagePath())))
                .describedAs("被引用的附件一个字节都不能动。孤儿判定只看 sys_attachment_ref，"
                        + "这正是那张表存在的理由")
                .isTrue();
    }

    @Test
    @DisplayName("TD-7.2：只清理超过 24 小时的，刚上传的孤儿要留着——运营正在填表单")
    void 新上传的孤儿不清理() {
        Attachment 刚上传 = 上传(造文件(PNG_HEADER, 100), "正在填表单.png",
                AttachmentScene.GENERAL, AttachmentOwnerType.CASE);

        cleanup.cleanup(OffsetDateTime.now().minusHours(24));

        assertThat(files.exists(Path.of(刚上传.storagePath())))
                .describedAs("附件是先上传后关联（开发 5.7.2 第 10 步）。"
                        + "按「没有引用就删」实现会把运营正在填的表单里的附件删掉")
                .isTrue();
    }

    @Test
    @DisplayName("TD-7.2：超过 24 小时未合并的分片目录被删，正在续传的目录留着")
    void 清理临时分片目录() {
        UploadTicket 断了的 = attachments.initUpload("传了一半.pdf", 1024,
                AttachmentScene.GENERAL, AttachmentOwnerType.DEMAND);
        UploadTicket 正在传的 = attachments.initUpload("正在传.pdf", 1024,
                AttachmentScene.GENERAL, AttachmentOwnerType.DEMAND);
        目录时间往前挪(断了的.uploadId());

        AttachmentCleanupJob.CleanupResult result = cleanup.cleanup(OffsetDateTime.now().minusHours(24));

        assertThat(result.tmpDirectories()).isPositive();
        assertThat(files.exists(临时目录(断了的.uploadId()))).isFalse();
        assertThat(files.exists(临时目录(正在传的.uploadId())))
                .describedAs("判定用最后修改时间：一个断网两天、今天又接着传的任务不该在半夜被清掉")
                .isTrue();
    }

    // -------------------------------------------------------------------------

    private Attachment 上传(byte[] content, String fileName, AttachmentScene scene,
                          AttachmentOwnerType ownerType) {
        UploadTicket ticket = attachments.initUpload(fileName, content.length, scene, ownerType);
        for (int i = 0; i < ticket.totalChunks(); i++) {
            传片(ticket.uploadId(), i, content);
        }
        return attachments.complete(ticket.uploadId());
    }

    private void 传片(String uploadId, int index, byte[] content) {
        int from = index * ChunkUploadStore.CHUNK_SIZE;
        int to = Math.min(content.length, from + ChunkUploadStore.CHUNK_SIZE);
        attachments.uploadChunk(uploadId, index,
                new ByteArrayInputStream(java.util.Arrays.copyOfRange(content, from, to)));
    }

    /** 造一个指定文件头 + 指定总长度的文件。 */
    private static byte[] 造文件(byte[] header, int totalSize) {
        byte[] content = new byte[Math.max(totalSize, header.length)];
        System.arraycopy(header, 0, content, 0, header.length);
        byte[] filler = "AI学院联合作战平台附件测试内容".getBytes(StandardCharsets.UTF_8);
        for (int i = header.length; i < content.length; i++) {
            content[i] = filler[i % filler.length];
        }
        return content;
    }

    private Path 临时目录(String uploadId) {
        return StorageProperties.tmpDir().resolve(uploadId);
    }

    private void 往前挪时间(long... attachmentIds) {
        for (long id : attachmentIds) {
            jdbc.update("UPDATE sys_attachment SET created_at = NOW() - INTERVAL '25 hours' WHERE id = ?", id);
        }
    }

    private void 目录时间往前挪(String uploadId) {
        Path dir = files.properties().rootPath().resolve(临时目录(uploadId));
        try {
            Files.setLastModifiedTime(dir, java.nio.file.attribute.FileTime.from(
                    OffsetDateTime.now().minusHours(25).toInstant()));
        } catch (IOException e) {
            throw new AssertionError(e);
        }
    }
}
