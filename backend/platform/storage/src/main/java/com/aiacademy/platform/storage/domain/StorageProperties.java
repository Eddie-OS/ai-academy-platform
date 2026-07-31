package com.aiacademy.platform.storage.domain;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 本地磁盘存储的根目录（规则 F4，开发 5.7.3、5.11.2）。
 *
 * <p>一期附件存本地磁盘，不上 MinIO（开发 1.6 不做项）。目录分四个：
 *
 * <ul>
 *   <li>{@code attachment}——业务附件，随对象长期存在；
 *   <li>{@code tmp}——分片上传的未合并分片，超过 24 小时由清理任务物理删除（TD-7.2）；
 *   <li>{@code import}——导入原文件与错误报告，供批次列表的「下载原文件／下载错误报告」；
 *   <li>{@code export}——导出文件。开发 5.11.2 明确要求与附件目录分开：导出文件可以随时重算，
 *       附件不能，两者的清理策略完全不同，混在一个目录里迟早会有人写出把附件一起删掉的清理任务。
 * </ul>
 *
 * <p><b>数据库只存相对路径</b>（开发 6.3.8）：绝对路径一旦落库，挂载点从 {@code /data} 换成
 * {@code /mnt/data} 就得 UPDATE 全表。
 *
 * @param root 存储根目录。容器内为 {@code /data}（挂载宿主机卷），本机开发默认 {@code ./data}
 */
@ConfigurationProperties("aiacademy.storage")
public record StorageProperties(String root) {

    public StorageProperties {
        root = (root == null || root.isBlank()) ? "./data" : root;
    }

    /**
     * 四个子目录一律以<b>相对路径</b>给出。
     *
     * <p>返回绝对路径的写法会让「存进 {@code storage_path} 的是相对路径」（规则 F4、开发 6.3.8）
     * 变成一条要靠调用方记住的纪律：拿到绝对路径的人顺手 {@code toString()} 落库，
     * 挂载点从 {@code /data} 换成 {@code /mnt/data} 时全表都要 UPDATE。
     * 只有 {@link #rootPath()} 是绝对的，而它只给 {@code LocalFileStore} 用。
     */
    public static Path attachmentDir() {
        return Paths.get("attachment");
    }

    public static Path tmpDir() {
        return Paths.get("tmp");
    }

    public static Path importDir() {
        return Paths.get("import");
    }

    public static Path exportDir() {
        return Paths.get("export");
    }

    public Path rootPath() {
        return Paths.get(root).toAbsolutePath().normalize();
    }
}
