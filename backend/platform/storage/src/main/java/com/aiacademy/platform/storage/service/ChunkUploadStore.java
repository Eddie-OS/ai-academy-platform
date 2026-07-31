package com.aiacademy.platform.storage.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import com.aiacademy.platform.storage.domain.AttachmentScene;
import com.aiacademy.platform.storage.domain.StorageProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

/**
 * 分片上传的暂存目录（开发 5.7.2 第 5 步、要点 1）。
 *
 * <p><b>为什么申请上传的信息落文件而不是内存 Map：</b>断点续传（P5）的场景就是「上传中断」，
 * 而应用重启是中断的一种。信息在内存里，重启后前端拿着 uploadId 回来续传，服务端已经不认识它，
 * 200MB 只能从头再传。落成 {@code tmp/{uploadId}/manifest.properties} 之后，
 * 续传只依赖磁盘上还在的东西，而清理任务删 tmp 目录时连它一起删，不需要额外的过期逻辑。
 *
 * <p>也没有为它建表：44 张表是与需求对齐过的清单，为一个 24 小时后就该消失的中间态加一张表，
 * 代价是它会出现在备份、Schema 约定测试与将来每一次表清单核对里。
 */
@Component
public class ChunkUploadStore {

    /** 开发 5.7.2 第 3 步建议 5MB。 */
    public static final int CHUNK_SIZE = 5 * 1024 * 1024;

    private static final String MANIFEST = "manifest.properties";
    private static final String MERGED = "merged.bin";

    private final LocalFileStore files;

    public ChunkUploadStore(LocalFileStore files) {
        this.files = files;
    }

    public record Manifest(String fileName, long fileSize, AttachmentScene scene,
                           AttachmentOwnerType ownerType, int totalChunks) {
    }

    public Path dirOf(String uploadId) {
        checkUploadId(uploadId);
        return StorageProperties.tmpDir().resolve(uploadId);
    }

    public Path chunkPath(String uploadId, int index) {
        if (index < 0) {
            throw new BizException(ErrorCode.PARAM_INVALID, "分片序号不能为负：" + index);
        }
        return dirOf(uploadId).resolve(String.valueOf(index));
    }

    public Path mergedPath(String uploadId) {
        return dirOf(uploadId).resolve(MERGED);
    }

    public void writeManifest(String uploadId, Manifest manifest) {
        Properties properties = new Properties();
        properties.setProperty("fileName", manifest.fileName());
        properties.setProperty("fileSize", String.valueOf(manifest.fileSize()));
        properties.setProperty("scene", manifest.scene().name());
        properties.setProperty("ownerType", manifest.ownerType().name());
        properties.setProperty("totalChunks", String.valueOf(manifest.totalChunks()));

        var buffer = new java.io.ByteArrayOutputStream();
        try (OutputStream out = buffer) {
            properties.store(out, "分片上传申请信息（开发 5.7.2）");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        files.write(dirOf(uploadId).resolve(MANIFEST),
                new java.io.ByteArrayInputStream(buffer.toByteArray()));
    }

    public Manifest readManifest(String uploadId) {
        Path path = dirOf(uploadId).resolve(MANIFEST);
        if (!files.exists(path)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "上传任务不存在或已过期（超过 24 小时的未合并分片会被清理）：" + uploadId);
        }
        Properties properties = new Properties();
        try (InputStream in = files.open(path)) {
            properties.load(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return new Manifest(
                properties.getProperty("fileName"),
                Long.parseLong(properties.getProperty("fileSize")),
                AttachmentScene.valueOf(properties.getProperty("scene")),
                AttachmentOwnerType.valueOf(properties.getProperty("ownerType")),
                Integer.parseInt(properties.getProperty("totalChunks")));
    }

    /** 已在服务端的分片序号，升序。断点续传（P5）只需要这一个信息。 */
    public List<Integer> uploadedChunks(String uploadId) {
        Path dir = files.properties().rootPath().resolve(dirOf(uploadId));
        if (!Files.isDirectory(dir)) {
            return List.of();
        }
        List<Integer> indexes = new ArrayList<>();
        try (var list = Files.list(dir)) {
            list.forEach(path -> {
                String name = path.getFileName().toString();
                if (name.chars().allMatch(Character::isDigit) && !name.isEmpty()) {
                    indexes.add(Integer.parseInt(name));
                }
            });
        } catch (IOException e) {
            throw new UncheckedIOException("读取分片目录失败：" + uploadId, e);
        }
        indexes.sort(Integer::compareTo);
        return indexes;
    }

    public void discard(String uploadId) {
        files.deleteDirectory(dirOf(uploadId));
    }

    /**
     * uploadId 直接参与拼路径，因此只允许 UUID 那一类字符。
     *
     * <p>{@code LocalFileStore} 已经挡了路径穿越，这一道是为了让报错停在入口而不是深处，
     * 而且 {@code ../} 这种 uploadId 若能走到 {@code deleteDirectory}，报错就来不及了。
     */
    private static void checkUploadId(String uploadId) {
        if (uploadId == null || !uploadId.matches("[0-9a-fA-F-]{8,64}")) {
            throw new BizException(ErrorCode.PARAM_INVALID, "非法的 uploadId");
        }
    }
}
