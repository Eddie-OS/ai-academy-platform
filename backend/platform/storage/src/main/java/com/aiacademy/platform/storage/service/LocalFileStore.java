package com.aiacademy.platform.storage.service;

import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.platform.storage.domain.StorageProperties;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.List;

/**
 * 本地磁盘读写（规则 F4）。
 *
 * <p><b>这是全系统唯一接触文件系统的类。</b>二期换对象存储时只改这里，业务代码不动
 * （需求 F4「可切换的存储接口」、C13 第 2 条）。因此它的方法签名刻意只用 {@code InputStream}、
 * {@code OutputStream} 与相对路径，不暴露 {@link Path} 以外的本地概念。
 *
 * <p><b>禁止把文件读进内存</b>：课件类附件上限 200MB（规则 F1），{@code readAllBytes} 一次就能
 * 让 64G 单机上的 JVM 和 PostgreSQL 抢内存（开发 5.7.4 坑一、坑二）。合并分片用
 * {@link FileChannel#transferTo}，下载走流式拷贝。
 */
@Service
public class LocalFileStore {

    private final StorageProperties properties;

    public LocalFileStore(StorageProperties properties) {
        this.properties = properties;
    }

    /**
     * 把上传流写到 {@code 根目录/relativePath}，返回写入的字节数。
     *
     * <p>父目录不存在时自动建。同名文件覆盖——调用方给的相对路径都带自增 ID 或 uploadId，
     * 撞名意味着调用方逻辑有问题，静默覆盖比抛异常更难查，因此这里用
     * {@code CREATE_NEW} 之外的语义前请先想清楚：目前唯一会重复写同一路径的场合是分片重传
     * （断点续传要求同一分片可以重传），那正需要覆盖。
     */
    public long write(Path relativePath, InputStream in) {
        Path target = resolve(relativePath);
        try {
            Files.createDirectories(target.getParent());
            try (OutputStream out = Files.newOutputStream(target,
                    StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
                return in.transferTo(out);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("写文件失败：" + relativePath, e);
        }
    }

    /**
     * 按序号把多个分片流式合并成一个文件，返回总字节数。
     *
     * <p>用 {@link FileChannel#transferTo} 而不是逐段 {@code read/write}：200MB 的合并在
     * 用户空间来回搬一遍是纯浪费，{@code transferTo} 走内核零拷贝（开发 5.7.4 坑一）。
     */
    public long merge(List<Path> relativeChunks, Path relativeTarget) {
        Path target = resolve(relativeTarget);
        try {
            Files.createDirectories(target.getParent());
            try (FileChannel out = FileChannel.open(target,
                    StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
                long total = 0;
                for (Path chunk : relativeChunks) {
                    try (FileChannel in = FileChannel.open(resolve(chunk), StandardOpenOption.READ)) {
                        long size = in.size();
                        long copied = 0;
                        while (copied < size) {
                            copied += in.transferTo(copied, size - copied, out);
                        }
                        total += copied;
                    }
                }
                return total;
            }
        } catch (IOException e) {
            throw new UncheckedIOException("合并分片失败：" + relativeTarget, e);
        }
    }

    public InputStream open(Path relativePath) {
        try {
            return Files.newInputStream(resolve(relativePath), StandardOpenOption.READ);
        } catch (IOException e) {
            throw new UncheckedIOException("读文件失败：" + relativePath, e);
        }
    }

    public boolean exists(Path relativePath) {
        return Files.exists(resolve(relativePath));
    }

    public long size(Path relativePath) {
        try {
            return Files.size(resolve(relativePath));
        } catch (IOException e) {
            throw new UncheckedIOException("读文件大小失败：" + relativePath, e);
        }
    }

    public void move(Path relativeFrom, Path relativeTo) {
        Path to = resolve(relativeTo);
        try {
            Files.createDirectories(to.getParent());
            Files.move(resolve(relativeFrom), to, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("移动文件失败：" + relativeFrom, e);
        }
    }

    /**
     * 物理删除。
     *
     * <p><b>只有两个合法调用方</b>：孤儿附件清理与 tmp 分片清理（TD-7.2、5.11.1）。业务附件的删除
     * 是逻辑删除（规则 F5）——历史版本快照可能仍引用同一个文件，物理删会破坏 R7 的版本留档。
     */
    public boolean deletePhysically(Path relativePath) {
        try {
            return Files.deleteIfExists(resolve(relativePath));
        } catch (IOException e) {
            throw new UncheckedIOException("删除文件失败：" + relativePath, e);
        }
    }

    /** 删除整个目录（含内容）。用于 tmp 分片目录的清理。 */
    public void deleteDirectory(Path relativePath) {
        Path dir = resolve(relativePath);
        if (!Files.exists(dir)) {
            return;
        }
        try (var walk = Files.walk(dir)) {
            walk.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.delete(path);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
        } catch (IOException e) {
            throw new UncheckedIOException("删除目录失败：" + relativePath, e);
        }
    }

    public StorageProperties properties() {
        return properties;
    }

    /**
     * 相对路径 → 绝对路径，并挡住路径穿越。
     *
     * <p>相对路径里含用户提供的原始文件名（开发 5.7.3 的命名规则保留原名），
     * {@code ../../etc/passwd} 这种输入必须挡住。判断方式是规范化之后仍在根目录下——
     * 比逐个过滤 {@code ..}、{@code /}、{@code \} 可靠，后者永远漏得掉一种编码。
     */
    private Path resolve(Path relativePath) {
        Path root = properties.rootPath();
        Path resolved = root.resolve(relativePath).normalize();
        if (!resolved.startsWith(root)) {
            throw new BizException(ErrorCode.PARAM_INVALID, "非法文件路径");
        }
        return resolved;
    }

    /**
     * 清掉文件名里的路径分隔符与穿越片段，供拼相对路径用。
     *
     * <p>与 {@link #resolve} 是两道独立的防线：这一道保证存进数据库的 {@code storage_path} 是干净的，
     * 那一道保证即使脏路径进了库也读不到根目录外面。
     */
    public static String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "unnamed";
        }
        String cleaned = fileName.replace('\\', '/');
        cleaned = cleaned.substring(cleaned.lastIndexOf('/') + 1);
        cleaned = cleaned.replace("..", "").trim();
        return cleaned.isEmpty() ? "unnamed" : cleaned;
    }
}
