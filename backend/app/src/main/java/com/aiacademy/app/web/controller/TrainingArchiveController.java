package com.aiacademy.app.web.controller;

import com.aiacademy.business.training.domain.TrainingArchive;
import com.aiacademy.business.training.domain.TrainingArchiveForm;
import com.aiacademy.business.training.service.TrainingArchiveService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 场次详情的「培训归档」页签（需求 11.6，页面 P4-4）。
 *
 * <p>三类附件不走这里：前端拿 {@code /api/attachments} 三段式上传拿到附件 ID 后，
 * 用 {@code POST /api/attachments/{id}/refs} 挂到 {@code TRAINING_SESSION} 上，
 * {@code refField} 取 {@code ArchiveAttachmentFields} 的三个值之一。
 */
@RestController
@RequestMapping("/api/training-sessions/{sessionId}/archive")
public class TrainingArchiveController {

    private final TrainingArchiveService archives;

    public TrainingArchiveController(TrainingArchiveService archives) {
        this.archives = archives;
    }

    /** 没归档过的场次返回一条 {@code id} 为 null 的空记录，不是 404。 */
    @GetMapping
    public R<TrainingArchive> get(@PathVariable long sessionId) {
        return R.ok(archives.get(sessionId));
    }

    @WriteApi
    @PutMapping
    public R<TrainingArchive> save(@PathVariable long sessionId,
                                   @Valid @RequestBody TrainingArchiveForm form) {
        return R.ok(archives.save(sessionId, form));
    }
}
