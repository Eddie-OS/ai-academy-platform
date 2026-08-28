package com.aiacademy.app.export;

import com.alibaba.excel.EasyExcel;
import com.aiacademy.app.repository.ExportTaskMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.storage.domain.StorageProperties;
import com.aiacademy.platform.storage.service.LocalFileStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;

/**
 * 列表导出（开发 5.11.2）：≤2000 同步；&gt;2000 异步落盘 + 前端轮询。不加水分。
 *
 * <p>当前假设单实例部署，多实例需引入分布式锁。
 */
@Service
public class ListExportService {

    private static final Logger log = LoggerFactory.getLogger(ListExportService.class);
    public static final int SYNC_THRESHOLD = 2000;

    private final ExportTaskMapper tasks;
    private final LocalFileStore files;
    private final ObjectMapper json;
    private final ExecutorService workers = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "export-worker");
        t.setDaemon(true);
        return t;
    });

    public ListExportService(ExportTaskMapper tasks, LocalFileStore files, ObjectMapper json) {
        this.tasks = tasks;
        this.files = files;
        this.json = json;
    }

    public record SyncOrAsync(boolean async, Long taskId, ResponseEntity<Resource> syncBody) {
        public static SyncOrAsync sync(ResponseEntity<Resource> body) {
            return new SyncOrAsync(false, null, body);
        }

        public static SyncOrAsync async(long taskId) {
            return new SyncOrAsync(true, taskId, null);
        }
    }

    /**
     * @param totalHint 列表 total，决定同步／异步
     * @param allRows   复用列表筛选条件拉全量（调用方负责分页拼装）
     */
    public <R> SyncOrAsync exportAll(String resourceType,
                                     Object querySnapshot,
                                     long totalHint,
                                     Supplier<List<R>> allRows,
                                     List<String> headers,
                                     java.util.function.Function<R, Map<String, Object>> rowMapper) {
        if (totalHint <= SYNC_THRESHOLD) {
            try {
                return SyncOrAsync.sync(toResponse(resourceType, headers, allRows.get(), rowMapper));
            } catch (IOException e) {
                throw new BizException(ErrorCode.INTERNAL_ERROR, "导出文件写入失败");
            }
        }
        String queryJson;
        try {
            queryJson = json.writeValueAsString(querySnapshot);
        } catch (Exception e) {
            queryJson = String.valueOf(querySnapshot);
        }
        ExportTaskMapper.ExportInsert insert = new ExportTaskMapper.ExportInsert();
        insert.resourceType = resourceType;
        insert.queryJson = queryJson;
        insert.expiresAt = OffsetDateTime.now().plusDays(7);
        insert.createdBy = OperatorContext.current().account().name();
        tasks.insert(insert);
        long taskId = insert.id;
        workers.submit(() -> {
            try {
                tasks.markRunning(taskId);
                List<R> rows = allRows.get();
                Path file = writeFile(resourceType, headers, rows, rowMapper);
                Path relative = StorageProperties.exportDir().resolve(file.getFileName().toString());
                tasks.finish(taskId, "DONE", file.getFileName().toString(),
                        relative.toString().replace('\\', '/'), (long) rows.size(), null);
            } catch (Exception ex) {
                log.error("异步导出失败 taskId={}", taskId, ex);
                tasks.finish(taskId, "FAILED", null, null, null,
                        ex.getMessage() == null ? "导出失败" : ex.getMessage());
            }
        });
        return SyncOrAsync.async(taskId);
    }

    @Transactional(readOnly = true)
    public ExportTask status(long id) {
        ExportTask task = tasks.findById(id);
        if (task == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "导出任务不存在");
        }
        return task;
    }

    public ResponseEntity<Resource> download(long id) {
        ExportTask task = status(id);
        if (!"DONE".equals(task.status()) || task.storagePath() == null) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED, "导出尚未完成或已失败");
        }
        Path abs = files.properties().rootPath().resolve(task.storagePath());
        if (!Files.isRegularFile(abs)) {
            throw new BizException(ErrorCode.NOT_FOUND, "导出文件不存在或已清理");
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + task.fileName() + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(new FileSystemResource(abs));
    }

    private <R> ResponseEntity<Resource> toResponse(String resourceType,
                                                    List<String> headers,
                                                    List<R> rows,
                                                    java.util.function.Function<R, Map<String, Object>> rowMapper)
            throws IOException {
        Path file = writeFile(resourceType, headers, rows, rowMapper);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + file.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(new FileSystemResource(file));
    }

    private <R> Path writeFile(String resourceType,
                               List<String> headers,
                               List<R> rows,
                               java.util.function.Function<R, Map<String, Object>> rowMapper) throws IOException {
        Path dir = files.properties().rootPath().resolve(StorageProperties.exportDir());
        Files.createDirectories(dir);
        String name = resourceType + "-" + System.currentTimeMillis() + ".xlsx";
        Path file = dir.resolve(name);
        List<List<String>> head = headers.stream().map(List::of).toList();
        List<List<Object>> data = new ArrayList<>(rows.size());
        for (R row : rows) {
            Map<String, Object> map = rowMapper.apply(row);
            List<Object> line = new ArrayList<>(headers.size());
            for (String h : headers) {
                Object v = map.get(h);
                line.add(v == null ? "" : v);
            }
            data.add(line);
        }
        try (OutputStream out = Files.newOutputStream(file)) {
            EasyExcel.write(out).head(head).sheet("导出").doWrite(data);
        }
        return file;
    }

    public static Map<String, Object> row(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            map.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return map;
    }
}
