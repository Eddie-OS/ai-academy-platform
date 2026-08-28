package com.aiacademy.app.web.controller;

import com.aiacademy.app.export.ExportTask;
import com.aiacademy.app.export.ListExportService;
import com.aiacademy.common.api.R;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 异步导出任务状态与下载（开发 5.11.2）。前端每 3 秒轮询 status。
 */
@RestController
@RequestMapping("/api/exports")
public class ExportController {

    private final ListExportService exports;

    public ExportController(ListExportService exports) {
        this.exports = exports;
    }

    @GetMapping("/{id}")
    public R<ExportTask> status(@PathVariable long id) {
        return R.ok(exports.status(id));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable long id) {
        return exports.download(id);
    }
}
